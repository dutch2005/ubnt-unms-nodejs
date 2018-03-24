'use strict';

const { Reader: reader } = require('monet');
const { Observable } = require('rxjs/Rx');
const { when } = require('ramda');
const { getOr, some, isNull, isError } = require('lodash/fp');

const { DeviceNotFoundError } = require('../../device-store/errors');
const { toMs, pathNotEq } = require('../../util');
const { TaskStatusEnum } = require('../../enums');

const EXPECTED_UPGRADE_DURATION = toMs('minutes', 8);
const UPGRADE_STATUS_CHECK_INTERVAL = toMs('seconds', 3);
const UPGRADE_TIMEOUT = toMs('minutes', 10);

/**
 * Periodically pull device from DB
 *
 * @param {string} deviceId
 * @return {Observable}
 */
const trackUpgradeProgress = deviceId => reader(
  ({ DB }) => Observable.defer(() => DB.device.findById(deviceId))
    .repeatWhen(notifications => notifications.delay(UPGRADE_STATUS_CHECK_INTERVAL))
);

/**
 * @param {Object|boolean} result
 * @return {Observable}
 */
const handleError = (result) => {
  if (result instanceof DeviceNotFoundError) { return Observable.throw(result) }

  if (pathNotEq(['data', 'UPGRADE_ONU', 'success'], '1', result)) {
    return Observable.throw(new Error(getOr('Upgrade failed to start', ['data', 'UPGRADE_ONU', 'error'], result)));
  }

  return Observable.of(result);
};

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
   * @param {Settings} settings
   * @param {Tasks} taskManager
   * @param {string} taskId
   * @return {Observable}
   */
  ({ DB, deviceStore, settings, taskManager, taskId }) => {
    const firmwareUrl = `${settings.firmwaresWsUrl()}${firmware.secureUrl}`;
    const deviceId = device.identification.id;
    const oltId = getOr(null, ['onu', 'id'], device);
    const oltPort = getOr(null, ['onu', 'port'], device);
    const onuSerial = getOr(null, ['identification', 'serialNumber'], device);

    if (some(isNull, [oltId, oltPort, onuSerial])) {
      return Observable.throw(new Error('Not enough information to upgrade ONU'));
    }

    // initial upgrade status update, next updates are from OLT
    deviceStore.updateOnuUpgradeStatus(oltId, deviceId, {
      status: TaskStatusEnum.InProgress,
      expectedDuration: EXPECTED_UPGRADE_DURATION,
      firmware,
    });

    const taskStart = Date.now();
    return Observable.fromPromise(taskManager.startTask(taskId))
      .map(() => deviceStore.get(oltId))
      .do(when(isNull, () => { throw new Error('Olt not connected') }))
      .mergeMap(commOlt => commOlt.upgradeOnu(onuSerial, oltPort, firmwareUrl))
      .mergeMap(handleError)
      .mergeMap(() => trackUpgradeProgress(deviceId).run({ DB })
        .map(getOr({ changedAt: 0 }, 'upgrade')) // extract upgrade information from device structure
        .switchMap(({ changedAt, status, error }) => {
          // ignore, status haven't changed yet or upgrade didn't start
          if (taskStart > changedAt || status === TaskStatusEnum.Queued) { return Observable.empty() }

          if (status === TaskStatusEnum.InProgress) {
            const elapsedTime = Date.now() - changedAt;
            const progress = elapsedTime / EXPECTED_UPGRADE_DURATION;
            return Observable.fromPromise(taskManager.updateProgress(taskId, progress))
              .ignoreElements();
          }

          // update upgrade status
          deviceStore.updateOnuUpgradeStatus(oltId, deviceId, { status, error });

          return Observable.of({ changedAt, status, error });
        })
        .first() // take only one
        .timeoutWith(UPGRADE_TIMEOUT, Observable.throw(new Error('ONU upgrade timeout')))
      )
      .catch((error) => {
        const upgradeStatus = { status: TaskStatusEnum.Failed, error: isError(error) ? error.message : String(error) };
        deviceStore.updateOnuUpgradeStatus(oltId, deviceId, upgradeStatus);
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
  ({ deviceStore }) => {
    const oltId = getOr(null, ['onu', 'id'], device);
    return deviceStore.updateOnuUpgradeStatus(
      oltId, device.identification.id, { status: TaskStatusEnum.Queued }
    );
  }
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
  ({ deviceStore }) => {
    const oltId = getOr(null, ['onu', 'id'], device);
    return deviceStore.updateOnuUpgradeStatus(
      oltId, device.identification.id, { status: TaskStatusEnum.Canceled }
    );
  }
);

module.exports = {
  upgrade,
  onEnqueue,
  cancel,
};
