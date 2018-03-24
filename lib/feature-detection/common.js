'use strict';

const { invert, has, __, getOr, eq, flow, invertBy, identity, curry, isNil } = require('lodash/fp');
const { anyPass } = require('ramda');

const { DeviceTypeEnum, DeviceCategoryEnum, DeviceModelEnum, DeviceTypeDetectionEnum } = require('../enums');
const { interfaces } = require('../../config');
const { isVlanCapableOnSwitch } = require('./vlan');
const { POE_SUPPORT } = require('./poe');
const { isInterfaceVisible } = require('./interfaces');

/**
 * Reversed DeviceModelEnum
 * @readonly
 * @enum {string}
 */
const MODEL_MAP = invert(DeviceModelEnum);

/**
 * @param model {DeviceModelEnum}
 * @return {boolean}
 */
const isDeviceModelSupported = has(__, MODEL_MAP);

/**
 * @param {DeviceModelEnum} model
 * @return {?string}
 */
const deviceTypeFromModel = getOr(null, __, DeviceTypeDetectionEnum);

/**
 * @params {DeviceTypeEnum}
 * @return {Array.<DeviceModelEnum>}
 */
const deviceModelsForType = curry(
  (typeModelMap, deviceType) => typeModelMap[deviceType]
)(invertBy(identity, DeviceTypeDetectionEnum));

/**
 * @param {DeviceTypeEnum} type
 * @return {?string}
 */
const deviceCategoryFromType = (type) => {
  switch (type) {
    case DeviceTypeEnum.Onu:
      return DeviceCategoryEnum.Optical;
    case DeviceTypeEnum.Olt:
    case DeviceTypeEnum.Erouter:
    case DeviceTypeEnum.Eswitch:
      return DeviceCategoryEnum.Wired;
    case DeviceTypeEnum.AirMax:
    case DeviceTypeEnum.AirCube:
      return DeviceCategoryEnum.Wireless;
    default:
      return null;
  }
};

/* eslint-disable no-fallthrough */
const isDeviceSupported = (model) => {
  if (isNil(model)) { return false }
  const isModelSupported = isDeviceModelSupported(model);
  if (!isModelSupported) { return false }

  const deviceType = deviceTypeFromModel(model);
  switch (deviceType) {
    case DeviceTypeEnum.Onu:
    case DeviceTypeEnum.Olt:
    case DeviceTypeEnum.Erouter:
    case DeviceTypeEnum.Eswitch:
    case DeviceTypeEnum.AirCube:
    case DeviceTypeEnum.AirMax:
      return true;
    default:
      return false;
  }
};
/* eslint-enable no-fallthrough */

/**
 * @typedef {Object} DeviceFeatures
 * @property {Object} defaults
 * @property {number} defaults.mtu
 * @property {number} defaults.pppoeMtu
 * @property {boolean} isVlanCapableOnSwitch
 * @property {isInterfaceVisibleForModel} isInterfaceVisible
 * @property {Object.<string, string[]>} poe
 */

/**
 * @param {string} model
 * @return {DeviceFeatures}
 */
const modelFeatures = model => ({
  defaults: {
    mtu: interfaces.mtuDefault,
    pppoeMtu: interfaces.pppoeMtuDefault,
  },
  isVlanCapableOnSwitch: isVlanCapableOnSwitch(model),
  isInterfaceVisible: isInterfaceVisible(model),
  poe: getOr({}, [model], POE_SUPPORT),
});

// isOltDeviceType :: DeviceModel -> Boolean
//     DeviceModel = String
const isOltDeviceType = flow(deviceTypeFromModel, eq(DeviceTypeEnum.Olt));

// isErouterDeviceType :: DeviceModel -> Boolean
//     DeviceModel = String
const isErouterDeviceType = flow(deviceTypeFromModel, eq(DeviceTypeEnum.Erouter));

// isEswitchDeviceType :: DeviceModel -> Boolean
//     DeviceModel = String
const isEswitchDeviceType = flow(deviceTypeFromModel, eq(DeviceTypeEnum.Eswitch));

// isOnuDeviceType :: DeviceModel -> Boolean
//     DeviceModel = String
const isOnuDeviceType = flow(deviceTypeFromModel, eq(DeviceTypeEnum.Onu));

// isAirCubeDeviceType :: DeviceModel -> Boolean
//     DeviceModel = String
const isAirCubeDeviceType = flow(deviceTypeFromModel, eq(DeviceTypeEnum.AirCube));

// isAirMaxDeviceType :: DeviceModel -> Boolean
//     DeviceModel = String
const isAirMaxDeviceType = flow(deviceTypeFromModel, eq(DeviceTypeEnum.AirMax));

// isWirelessType :: DeviceType -> Boolean
//     DeviceType = String
const isWirelessType = anyPass([eq(DeviceTypeEnum.AirMax), eq(DeviceTypeEnum.AirCube)]);


module.exports = {
  isDeviceModelSupported,
  isDeviceSupported,
  deviceTypeFromModel,
  deviceCategoryFromType,
  deviceModelsForType,
  modelFeatures,

  isOltDeviceType,
  isErouterDeviceType,
  isEswitchDeviceType,
  isOnuDeviceType,
  isAirCubeDeviceType,
  isAirMaxDeviceType,
  isWirelessType,
};
