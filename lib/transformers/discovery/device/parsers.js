'use strict';

const { isUndefined, defaultTo } = require('lodash/fp');
const { isNotUndefined, stubNull } = require('ramda-adjunct');

const { DeviceTypeEnum, DiscoveryConnectStatusEnum } = require('../../../enums');
const {
  isDeviceModelSupported, isDeviceSupported, deviceTypeFromModel, deviceCategoryFromType,
} = require('../../../feature-detection/common');
const { isFirmwareSupported, isPlatformIdSupported } = require('../../../feature-detection/firmware');
const { parseCommFirmwareVersion } = require('../../semver/parsers');
const { parseDeviceDescription } = require('../../device/model/parsers');
const { liftParser } = require('../../index');

const erouterParsers = require('../../device/erouter/parsers');
const eswitchParsers = require('../../device/eswitch/parsers');
const oltParsers = require('../../device/olt/parsers');
const airCubeParsers = require('../../device/aircube/parsers');
const airMaxParsers = require('../../device/airmax/parsers');

/**
 * @typedef {Object} CorrespondenceDiscoveryDevice
 * @property {?string} id UUID
 * @property {?string} userId UUID
 * @property {?string} resultId UUID
 * @property {string[]} possibleIds array of UUIDs
 * @property {Object} preferences
 * @property {DiscoveryConnectStatusEnum} connectStatus
 * @property {?DiscoveryConnectProgressEnum} connectProgress
 * @property {?string} connectError
 * @property {string} firmwareVersion
 * @property {string} platformId
 * @property {DeviceFirmwareDetails} firmware
 * @property {?DeviceModelEnum|string} model
 * @property {string} name
 * @property {string} mac
 * @property {string} ip
 * @property {DeviceTypeEnum} type
 * @property {DeviceCategoryEnum} category
 * @property {?string} siteId UUID
 * @property {boolean} authorized
 * @property {?ProgressStatusEnum} authenticationStatus
 * @property {?string} authenticationError
 * @property {boolean} hasCredentials
 * @property {boolean} isSupported
 * @property {boolean} isFirmwareSupported
 */

/**
 * @param {*} auxiliaries
 * @param {HwDiscoveryDevice} hwDiscoveryDevice
 * @return {DeviceModelEnum}
 */
const parseHwDiscoveryDeviceModel = (auxiliaries, hwDiscoveryDevice) => {
  // model is supported
  if (isDeviceModelSupported(hwDiscoveryDevice.model)) { return hwDiscoveryDevice.model }

  // get model from description, model or hostname
  const { description, model, hostname } = hwDiscoveryDevice;
  for (const possibleValue of [description, model, hostname]) { // eslint-disable-line no-restricted-syntax
    const possibleModel = parseDeviceDescription(possibleValue);
    if (isDeviceModelSupported(possibleModel)) { return possibleModel }
  }

  return null;
};

/**
 * @param {Object} auxiliaries
 * @param {HwDiscoveryDevice} hwDiscoveryDevice
 * @return {?string}
 */
const parseHwDiscoveryPlatformId = (auxiliaries, hwDiscoveryDevice) => {
  const model = isNotUndefined(auxiliaries.model)
    ? auxiliaries.model
    : parseHwDiscoveryDeviceModel(auxiliaries, hwDiscoveryDevice);
  const type = deviceTypeFromModel(model);

  let parser;
  switch (type) {
    case DeviceTypeEnum.Olt:
      parser = oltParsers.parsePlatformId;
      break;
    case DeviceTypeEnum.Erouter:
      parser = erouterParsers.parsePlatformId;
      break;
    case DeviceTypeEnum.Eswitch:
      parser = eswitchParsers.parsePlatformId;
      break;
    case DeviceTypeEnum.AirMax:
      parser = airMaxParsers.parsePlatformId;
      break;
    case DeviceTypeEnum.AirCube:
      parser = airCubeParsers.parsePlatformId;
      break;
    default:
      parser = stubNull;
  }

  const platformId = parser(hwDiscoveryDevice.firmwareVersion);

  return isPlatformIdSupported(platformId) ? platformId : null;
};

/**
 * @param {Object} auxiliaries
 * @param {HwDiscoveryDevice} hwDiscoveryDevice
 * @return {CorrespondenceDiscoveryDevice}
 */
const parseHwDiscoveryDevice = (auxiliaries, hwDiscoveryDevice) => {
  const model = parseHwDiscoveryDeviceModel(auxiliaries, hwDiscoveryDevice);
  const type = deviceTypeFromModel(model);
  const platformId = parseHwDiscoveryPlatformId({ model }, hwDiscoveryDevice);
  const category = deviceCategoryFromType(type);
  const firmwareVersion = parseCommFirmwareVersion(hwDiscoveryDevice.firmwareVersion);

  return ({
    id: null,
    userId: null,
    resultId: null,
    possibleIds: defaultTo([], hwDiscoveryDevice.ids),
    preferences: null,
    connectStatus: DiscoveryConnectStatusEnum.NotConnected,
    connectProgress: null,
    connectError: null,
    firmwareVersion,
    platformId,
    model,
    name: defaultTo(model, hwDiscoveryDevice.hostname),
    mac: defaultTo(null, hwDiscoveryDevice.mac),
    ip: hwDiscoveryDevice.ip,
    addresses: hwDiscoveryDevice.addresses,
    type,
    category,
    uptime: defaultTo(null, hwDiscoveryDevice.uptime),
    siteId: null,
    authorized: false,
    authenticationStatus: null,
    authenticationError: null,
    hasCredentials: false,
    isSupported: isDeviceSupported(model),
    isFirmwareSupported: isFirmwareSupported(platformId, firmwareVersion),
    firmware: isNotUndefined(auxiliaries.firmwareDal)
      ? auxiliaries.firmwareDal.findFirmwareDetails(platformId, firmwareVersion)
      : null,
  });
};

/**
 * @param {Object} auxiliaries
 * @param {DbDiscoveryDevice} dbDiscoveryDevice
 * @return {boolean}
 */
const parseDbDiscoveryDeviceCredentials = (auxiliaries, dbDiscoveryDevice) => {
  if (isUndefined(auxiliaries.discovery)) { return false }

  const { credentials } = auxiliaries.discovery;
  return credentials.get(dbDiscoveryDevice.userId, [dbDiscoveryDevice.id, dbDiscoveryDevice.ip]) !== null;
};

/**
 * @param {Object} auxiliaries
 * @param {DbDiscoveryDevice} dbDiscoveryDevice
 * @return {CorrespondenceDiscoveryDevice}
 */
const parseDbDiscoveryDevice = (auxiliaries, dbDiscoveryDevice) => ({
  id: dbDiscoveryDevice.id,
  userId: dbDiscoveryDevice.userId,
  resultId: dbDiscoveryDevice.resultId,
  possibleIds: dbDiscoveryDevice.possibleIds,
  preferences: dbDiscoveryDevice.preferences,
  connectStatus: dbDiscoveryDevice.connectStatus,
  connectProgress: dbDiscoveryDevice.connectProgress,
  connectError: dbDiscoveryDevice.connectError,
  firmwareVersion: dbDiscoveryDevice.firmwareVersion,
  platformId: dbDiscoveryDevice.platformId,
  model: dbDiscoveryDevice.model,
  name: dbDiscoveryDevice.name,
  mac: dbDiscoveryDevice.mac,
  ip: dbDiscoveryDevice.ip,
  type: dbDiscoveryDevice.type,
  category: dbDiscoveryDevice.category,
  uptime: dbDiscoveryDevice.uptime,
  siteId: null,
  authorized: null,
  authenticationStatus: dbDiscoveryDevice.authenticationStatus,
  authenticationError: dbDiscoveryDevice.authenticationError,
  hasCredentials: parseDbDiscoveryDeviceCredentials(auxiliaries, dbDiscoveryDevice),
  isSupported: isDeviceSupported(dbDiscoveryDevice.model),
  isFirmwareSupported: isFirmwareSupported(dbDiscoveryDevice.platformId, dbDiscoveryDevice.firmwareVersion),
  firmware: isNotUndefined(auxiliaries.firmwareDal)
    ? auxiliaries.firmwareDal.findFirmwareDetails(dbDiscoveryDevice.platformId, dbDiscoveryDevice.firmwareVersion)
    : null,
});

const parseDbDiscoveryDeviceList = (auxiliaries, dbDiscoveryDeviceList) => dbDiscoveryDeviceList
  .map(parseDbDiscoveryDevice.bind(null, auxiliaries));


module.exports = {
  parseHwDiscoveryDeviceModel,
  parseHwDiscoveryDevice,
  parseDbDiscoveryDevice,
  parseDbDiscoveryDeviceList,

  safeParseHwDiscoveryDevice: liftParser(parseHwDiscoveryDevice),
  safeParseDbDiscoveryDevice: liftParser(parseDbDiscoveryDevice),
  safeParseDbDiscoveryDeviceList: liftParser(parseDbDiscoveryDeviceList),
};
