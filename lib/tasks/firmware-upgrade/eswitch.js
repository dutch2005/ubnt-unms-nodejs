'use strict';

const { Reader: reader } = require('monet');
const { Observable } = require('rxjs/Rx');
const { constant, getOr, isError, isNull } = require('lodash/fp');
const { complement, pathEq, when } = require('ramda');
const { cata } = require('ramda-adjunct');

const { error: logError } = require('../../logging');
const { toMs } = require('../../util');
const { TaskStatusEnum, StatusEnum } = require('../../enums');
const { fromDb: fromDbDevice } = require('../../transformers/device');

const DEVICE_CONNECT_TIMEOUT = toMs('seconds', 15);
const CONNECTION_STATUS_CHECK_DELAY = toMs('seconds', 1);
const UPGRADE_TIMEOUT = toMs('minutes', 12);

const expectedUpgradeDuration = constant(toMs('minutes', 10));

const isDeviceConnected = complement(pathEq(['overview', 'status'], StatusEnum.Disconnected));

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
      .mergeMap(() => Observable.of(deviceStore.get(deviceId))
        .do(when(isNull, () => { throw new Error('Device not connected') }))
        .mergeMap(commDevice => commDevice.systemUpgrade(firmwareUrl))
        .switchMap(() => {
          const elapsedTime = Date.now() - taskStart;
          const progress = elapsedTime / expectedDuration;
          return Observable.fromPromise(taskManager.updateProgress(taskId, progress));
        })
        .last() // wait for all observables to complete
        .timeoutWith(UPGRADE_TIMEOUT, Observable.throw(new Error('Device upgrade timeout')))
      )
      .mergeMap(() => waitForDeviceToConnect(deviceId).run({ DB }) // upgrade finished
        .map(fromDbDevice({ firmwareDal }))
        .mergeMap(cata(Observable.throw, Observable.of))
        .mergeMap((upgradedDevice) => { // check upgrade version
          const firmwareVersion = getOr(null, ['firmware', 'current'], upgradedDevice);
          const expectedFirmwareVersion = firmware.identification.version;
          if (firmwareVersion === expectedFirmwareVersion) {
            const upgradeStatus = { status: TaskStatusEnum.Success };

            deviceStore.updateUpgradeStatus(deviceId, upgradeStatus);
            return Observable.of(upgradeStatus);
          }

          // eslint-disable-next-line max-len
          const errorMessage = `Unexpected upgrade result, expected firmware version ${expectedFirmwareVersion}, but got ${firmwareVersion}`;
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
