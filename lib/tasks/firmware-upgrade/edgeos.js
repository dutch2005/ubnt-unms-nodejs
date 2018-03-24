'use strict';

const { Reader: reader } = require('monet');
const { Observable } = require('rxjs/Rx');
const randomstring = require('randomstring');
const shellEscape = require('shell-escape');
const { constant, getOr, includes, isError } = require('lodash/fp');
const { complement, pathEq } = require('ramda');
const { cata } = require('ramda-adjunct');

const { CommandError } = require('../../device-store/errors');
const { error: logError } = require('../../logging');
const { toMs } = require('../../util');
const { TaskStatusEnum, DeviceModelEnum, StatusEnum } = require('../../enums');
const { fromDb: deviceFromDb } = require('../../transformers/device');

const DEVICE_CONNECT_TIMEOUT = toMs('seconds', 15);
const DEVICE_CONNECT_DELAY = toMs('seconds', 10);
const UPGRADE_STATUS_CHECK_DELAY = toMs('seconds', 3);
const CONNECTION_STATUS_CHECK_DELAY = toMs('seconds', 1);
const UPGRADE_TIMEOUT = toMs('minutes', 15);

const expectedUpgradeDuration = (device) => {
  const model = device.identification.model;
  switch (model) {
    case DeviceModelEnum.ERX: // - EdgeRouters
    case DeviceModelEnum.ERXSFP:
    case DeviceModelEnum.ERLite3:
    case DeviceModelEnum.ERPoe5:
    case DeviceModelEnum.ERPro8:
    case DeviceModelEnum.ER8:
    case DeviceModelEnum.EPR6:
    case DeviceModelEnum.EPR8:
    case DeviceModelEnum.ER8XG:
      return toMs('minutes', 5);
    case DeviceModelEnum.UFOLT: // - OLT
      return toMs('minutes', 7);
    default:
      return toMs('minutes', 6);
  }
};

// sudo /usr/bin/ubnt-upgrade --delete-noprompt is intentionally called twice, fixes issue when fw is not really removed
const upgradeScript = firmwareUrl => `#!/bin/sh
trap "rm -- \\"$0\\"" EXIT

HOST=$(grep "connection wss" /config/config.boot | cut -d"/" -f3- | cut -d"+" -f1)

sudo /usr/bin/ubnt-upgrade --delete-noprompt
sudo /usr/bin/ubnt-upgrade --delete-noprompt
sudo /usr/bin/ubnt-upgrade --upgrade-noprompt "https://\${HOST}${firmwareUrl}"

retval=$?

if [ $retval -ne 0 ]; then 
  echo "*UPGRADE FAILED*";
  exit 1;
else
  sudo /opt/vyatta/bin/sudo-users/vyatta-reboot.pl --action reboot --now || echo "*UPGRADE FAILED*"
fi
`;

const hasUpgradeScriptFailed = includes('*UPGRADE FAILED*');

const isDeviceConnected = complement(pathEq(['overview', 'status'], StatusEnum.Disconnected));

const runCommand = (deviceStore, deviceId, command) => Observable
  .defer(() => deviceStore.runCommand(deviceId, command));

const runUpgradeScript = firmwareUrl => reader(
  ({ deviceStore, deviceId }) => {
    const scriptFilename = `/tmp/${randomstring.generate({ length: 16 })}`;
    const stdoutFilename = `${scriptFilename}.log`;

    const script = upgradeScript(firmwareUrl);

    return runCommand(deviceStore, deviceId, `${shellEscape(['echo', script])} > ${scriptFilename}`)
      .mergeMap(() => runCommand(deviceStore, deviceId, `sh ${scriptFilename} > ${stdoutFilename} 2>&1 &`))
      .mapTo(stdoutFilename);
  }
);

const progressTracker = ({ rpcFailCount, cmdFailCount }, commandResult) => {
  // rpc call failed some way
  if (isError(commandResult) && !(commandResult instanceof CommandError)) {
    return { rpcFailCount: rpcFailCount + 1, cmdFailCount };
  }

  const returnCode = getOr(0, ['data', 'return'], commandResult);
  const output = getOr('', ['data', 'output'], commandResult);

  if (returnCode !== 0) { // cat command failed
    return { rpcFailCount, cmdFailCount: cmdFailCount + 1 };
  } else if (hasUpgradeScriptFailed(output)) { // check output for failed string
    logError(`Device upgrade has failed: ${output}`);
    throw new Error('Device upgrade has failed');
  }

  return { rpcFailCount, cmdFailCount };
};

const trackUpgradeProgress = deviceId => reader(
  ({ deviceStore, taskManager, taskStart, expectedDuration, taskId, stdoutFilename }) => Observable
    .defer(() => deviceStore.runCommand(deviceId, `cat ${stdoutFilename}`).catch(Observable.of))
    .repeatWhen(notifications => notifications.delay(UPGRADE_STATUS_CHECK_DELAY))
    .scan(progressTracker, { rpcFailCount: 0, cmdFailCount: 0 })
    .switchMap((counters) => {
      const elapsedTime = Date.now() - taskStart;
      const progress = elapsedTime / expectedDuration;
      return Observable.fromPromise(taskManager.updateProgress(taskId, progress))
        .mapTo(counters);
    })
    .first(({ cmdFailCount }) => cmdFailCount > 0)
    .delay(DEVICE_CONNECT_DELAY) // wait for database update
);

/**
 * @param {string} deviceId
 * @return {Reader.<waitForDeviceToConnect~callback>}
 */
const waitForDeviceToConnect = deviceId => reader(
  /**
   * @function waitForDeviceToConnect~callback
   * @param {DB} DB
   * @return {Observable}
   */
  ({ DB }) => Observable
    .defer(() => DB.device.findById(deviceId).catch(constant(null)))
    .repeatWhen(notifications => notifications.delay(CONNECTION_STATUS_CHECK_DELAY))
    .first(isDeviceConnected) // device is connected
    .timeoutWith(DEVICE_CONNECT_TIMEOUT, Observable.throw(new Error('Waiting for device to connect timeout')))
);

/**
 * @param {CorrespondenceDevice} device
 * @param {CorrespondenceFirmware} firmware
 * @return {!Reader.<upgrade~callback>}
 */
const upgrade = (device, firmware) => reader(
  /**
   * @function upgrade~callback
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {FirmwareDal} firmwareDal
   * @param {Settings} settings
   * @param {Tasks} taskManager
   * @param {string} taskId
   * @return {Observable}
   */
  ({ DB, deviceStore, firmwareDal, settings, taskManager, taskId }) => {
    const firmwareUrl = `${settings.firmwaresPublicUrl()}${firmware.secureUrl}`;
    const deviceId = device.identification.id;
    const expectedDuration = expectedUpgradeDuration(device);

    deviceStore.updateUpgradeStatus(deviceId, {
      status: TaskStatusEnum.InProgress,
      expectedDuration,
      firmware,
    });

    const taskStart = Date.now();
    return Observable.fromPromise(taskManager.startTask(taskId))
    // start and track upgrade progress
      .mergeMap(() => runUpgradeScript(firmwareUrl)
        .run({ deviceStore, deviceId })
        .switchMap(stdoutFilename => trackUpgradeProgress(deviceId)
          .run({ deviceStore, taskManager, taskStart, expectedDuration, taskId, stdoutFilename }))
        .timeoutWith(UPGRADE_TIMEOUT, Observable.throw(new Error('Device upgrade timeout')))
      )
      .mergeMap(() => waitForDeviceToConnect(deviceId).run({ DB }) // upgrade finished
        .map(deviceFromDb({ firmwareDal }))
        .mergeMap(cata(Observable.throw, Observable.of))
        .mergeMap((upgradedDevice) => { // check upgrade version
          const firmwareVersion = getOr(null, ['firmware', 'current'], upgradedDevice);
          const expectedFirmwareVersion = firmware.identification.version;
          if (firmwareVersion === expectedFirmwareVersion) {
            const upgradeStatus = { status: TaskStatusEnum.Success };

            deviceStore.updateUpgradeStatus(deviceId, upgradeStatus);
            return Observable.of(upgradeStatus);
          }

          const errorMessage =
`Unexpected upgrade result, expected firmware version ${expectedFirmwareVersion}, but got ${firmwareVersion}`;
          logError(errorMessage);
          return Observable.throw(new Error(errorMessage));
        }))
      .catch((error) => {
        const upgradeStatus = { status: TaskStatusEnum.Failed, error: isError(error) ? error.message : String(error) };
        deviceStore.updateUpgradeStatus(deviceId, upgradeStatus);
        return Observable.of(upgradeStatus);
      });
  }
);

/**
 * @param {CorrespondenceDevice} device
 * @return {!Reader.<onEnqueue~callback>}
 */
const onEnqueue = device => reader(
  /**
   * @function onEnqueue~callback
   * @param {DeviceStore} deviceStore
   * @return {boolean}
   */
  ({ deviceStore }) => deviceStore.updateUpgradeStatus(
    device.identification.id, { status: TaskStatusEnum.Queued }
  )
);

/**
 * @param {CorrespondenceDevice} device
 * @return {!Reader.<cancel~callback>}
 */
const cancel = device => reader(
  /**
   * @function cancel~callback
   * @param {DeviceStore} deviceStore
   * @return {boolean}
   */
  ({ deviceStore }) => deviceStore.updateUpgradeStatus(
    device.identification.id, { status: TaskStatusEnum.Canceled }
  )
);

module.exports = {
  upgrade,
  onEnqueue,
  cancel,
};
