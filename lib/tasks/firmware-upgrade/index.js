'use strict';

const { Reader: reader, Reader } = require('monet');
const { defaultTo } = require('lodash/fp');
const { Observable } = require('rxjs/Rx');

const { TaskTypeEnum, DeviceTypeEnum, TaskStatusEnum } = require('../../enums');

// upgrade procedures
const onuUpgrade = require('./onu');
const edgeOsUpgrade = require('./edgeos');
const eswitchUpgrade = require('./eswitch');
const airMaxUpgrade = require('./airmax');
const airCubeUpgrade = require('./aircube');

const defaultUpgrade = {
  upgrade: cmDevice => Reader.of(Observable.throw(new Error(`Cannot upgrade model ${cmDevice.identification.model}`))),
  cancel: () => Reader.of(false),
  onEnqueue: () => Reader.of(false),
};

/**
 * @callback upgradeFirmwareCallback
 * @param {*} dependencies
 * @return {Observable}
 */

/**
 * @callback cancelFirmwareUpgradeCallback
 * @param {*} dependencies
 * @return {boolean}
 */

/**
 * @callback enqueueFirmwareUpgradeCallback
 * @param {*} dependencies
 * @return {boolean}
 */

/**
 * @param {CorrespondenceDevice} cmDevice
 * @return {!Object}
 */
const deviceUpgrade = (cmDevice) => {
  const type = cmDevice.identification.type;
  switch (type) {
    case DeviceTypeEnum.Onu:
      return onuUpgrade;
    case DeviceTypeEnum.Erouter:
    case DeviceTypeEnum.Olt:
      return edgeOsUpgrade;
    case DeviceTypeEnum.Eswitch:
      return eswitchUpgrade;
    case DeviceTypeEnum.AirMax:
      return airMaxUpgrade;
    case DeviceTypeEnum.AirCube:
      return airCubeUpgrade;
    default:
      return defaultUpgrade;
  }
};

/**
 * @param {string} taskId
 * @param {CorrespondenceDevice} device
 * @param {CorrespondenceFirmware} firmware
 * @return {Reader.<worker~callback>}
 */
const worker = (taskId, { device, firmware }) => reader(
  /**
   * @function worker~callback
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {Settings} settings
   * @param {FirmwareDal} firmwareDal
   * @param {Tasks} taskManager
   * @return {Observable}
   */
  ({ DB, deviceStore, settings, firmwareDal, taskManager }) => deviceUpgrade(device)
    .upgrade(device, firmware)
    .run({ DB, deviceStore, settings, firmwareDal, taskManager, taskId })
    .mergeMap(({ status, error }) => {
      if (status === TaskStatusEnum.Success) {
        return taskManager.completeTask(taskId);
      }
      const errorMessage = defaultTo('Device upgrade has failed', error);
      return Observable.throw(new Error(errorMessage));
    })
    .catch(error => taskManager.failTask(taskId, String(error)))
);

const discriminator = task => task.type === TaskTypeEnum.FirmwareUpgrade;

/**
 * @param {string} taskId
 * @param {CorrespondenceDevice} device
 * @return {Reader.<onEnqueue~callback>}
 */
const onEnqueue = (taskId, { device }) => reader(
  /**
   * @function onEnqueue~callback
   * @param {DeviceStore} deviceStore
   * @return {boolean}
   */
  ({ deviceStore }) => deviceUpgrade(device)
    .onEnqueue(device)
    .run({ deviceStore })
);

/**
 * @param {string} taskId
 * @param {CorrespondenceDevice} device
 * @return {Reader.<canceler~callback>}
 */
const canceler = (taskId, { device }) => reader(
  /**
   * @function canceler~callback
   * @param {DeviceStore} deviceStore
   * @return {boolean}
   */
  ({ deviceStore }) => deviceUpgrade(device)
    .cancel(device)
    .run({ deviceStore })
);

module.exports = { worker, discriminator, onEnqueue, canceler };
