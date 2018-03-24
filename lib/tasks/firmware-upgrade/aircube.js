'use strict';

const { Reader: reader } = require('monet');
const { Observable } = require('rxjs/Rx');
const randomstring = require('randomstring');
const shellEscape = require('shell-escape');
const { constant, getOr, includes, isError } = require('lodash/fp');
const { complement, pathEq } = require('ramda');
const { cata } = require('ramda-adjunct');

const { CommandError, DeviceNotFoundError } = require('../../device-store/errors');
const { error: logError } = require('../../logging');
const { toMs, pathNotEq } = require('../../util');
const { TaskStatusEnum, StatusEnum } = require('../../enums');
const { fromDb: deviceFromDb } = require('../../transformers/device');

const DEVICE_CONNECT_TIMEOUT = toMs('seconds', 15);
const UPGRADE_STATUS_CHECK_DELAY = toMs('seconds', 3);
const CONNECTION_STATUS_CHECK_DELAY = toMs('seconds', 1);
const UPGRADE_TIMEOUT = toMs('minutes', 10);

const COMMAND_MAX_RETRIES = 3;
const COMMAND_RETRY_DELAY = toMs('seconds', 3);

const expectedUpgradeDuration = constant(toMs('minutes', 6));

/*
 Usage: ubus [<options>] <command> [arguments...]
 Options:
 -s <socket>: Set the unix domain socket to connect to
 -t <timeout>: Set the timeout (in seconds) for a command to complete
 -S: Use simplified output (for scripts)
 -v: More verbose output
 -m <type>: (for monitor): include a specific message type
 (can be used more than once)
 -M <r|t> (for monitor): only capture received or transmitted traffic

 Commands:
 - list [<path>] List objects
 - call <path> <method> [<message>] Call an object method
 - listen [<path>...] Listen for events
 - send <type> [<message>] Send an event
 - wait_for <object> [<object>...] Wait for multiple objects to appear on ubus
 - monitor Monitor ubus traffic
*/

const upgradeScript = firmwareUrl => `#!/bin/sh
trap "rm -- \\"$0\\"" EXIT

FIRMWARE_FILE="/tmp/firmware.bin"
LOCK_FILE="/tmp/fwup-started"

if [ -f "$LOCK_FILE" ]; then
  echo "*ALREADY IN PROGRESS*"
  exit 0
fi

trap "{ rm -f \\"$LOCK_FILE\\"; rm -- \\"$0\\"; }" EXIT
touch "$LOCK_FILE"

rm -f "$FIRMWARE_FILE"
wget --no-check-certificate -O "$FIRMWARE_FILE" "${firmwareUrl}" || echo "*DOWNLOAD FAILED*"
ubus -S call rpc-sys upgrade_test "{}" | grep -q "\\"code\\":0" && ubus -S call rpc-sys upgrade_start "{}"
exit 0
`;

const hasDownloadFailed = includes('*DOWNLOAD FAILED*');
const isUpgradeAlreadyInProgress = includes('*ALREADY IN PROGRESS*');

const isDeviceConnected = complement(pathEq(['overview', 'status'], StatusEnum.Disconnected));

/**
 * @param {Object|boolean} result
 * @return {Observable}
 */
const handleError = (result) => {
  if (result instanceof DeviceNotFoundError) { return Observable.throw(result) }

  if (pathNotEq(['data', 'return'], 0, result)) {
    return Observable.throw(new Error(getOr('Command failed', ['data', 'output'], result)));
  }

  return Observable.of(getOr('', ['data', 'output'], result));
};

const runCommand = (deviceStore, deviceId, command) => Observable
  .defer(() => deviceStore.runCommand(deviceId, command))
  .switchMap(handleError)
  .retryWhen(notifications => notifications.take(COMMAND_MAX_RETRIES).delay(COMMAND_RETRY_DELAY));

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

  const output = getOr('', ['data', 'output'], commandResult);

  if (commandResult instanceof CommandError) { // cat command failed
    return { rpcFailCount, cmdFailCount: cmdFailCount + 1 };
  } else if (isUpgradeAlreadyInProgress(output)) {
    logError(`Device upgrade already in progress: ${commandResult}`);
    throw new Error('Device upgrade already in progress');
  } else if (hasDownloadFailed(output)) {
    logError(`Downloading firmware from device has failed: ${commandResult}`);
    throw new Error('Downloading firmware from device has failed');
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
    const firmwareUrl = `${settings.firmwaresWsUrl()}${firmware.secureUrl}`;
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
