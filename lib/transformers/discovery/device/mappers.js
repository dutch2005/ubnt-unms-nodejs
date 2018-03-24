'use strict';

const aguid = require('aguid');
const { isNull, map } = require('lodash/fp');
const { when } = require('ramda');

const { DiscoveryDeviceFlagsEnum, DiscoveryConnectStatusEnum, ProgressStatusEnum } = require('../../../enums');
const { liftMapper } = require('../../index');
const { toApiSemver } = require('../../firmwares/mappers');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {DbDiscoveryDevice}
 */
const toDbDiscoveryDevice = cmDiscoveryDevice => ({
  id: when(isNull, aguid, cmDiscoveryDevice.id),
  userId: cmDiscoveryDevice.userId,
  resultId: cmDiscoveryDevice.resultId,
  possibleIds: cmDiscoveryDevice.possibleIds,
  connectStatus: cmDiscoveryDevice.connectStatus,
  firmwareVersion: cmDiscoveryDevice.firmwareVersion,
  platformId: cmDiscoveryDevice.platformId,
  model: cmDiscoveryDevice.model,
  name: cmDiscoveryDevice.name,
  mac: cmDiscoveryDevice.mac,
  ip: cmDiscoveryDevice.ip,
  type: cmDiscoveryDevice.type,
  category: cmDiscoveryDevice.category,
  uptime: cmDiscoveryDevice.uptime,
});

/**
 * @typedef {Object} ApiDiscoveryDeviceFirmware
 * @property {string} current
 * @property {string} latest
 * @property {boolean} compatible
 * @property {Object} semver
 * @property {ApiSemver} semver.current
 * @property {ApiSemver} semver.latest
 */

/**
 * @typedef {Object} ApiDiscoveryDevice
 * @property {Object} identification
 * @property {string} identification.id
 * @property {string} identification.firmwareVersion
 * @property {string} identification.model
 * @property {string} identification.mac
 * @property {string} identification.type
 * @property {string} identification.category
 * @property {?string} identification.siteId
 * @property {boolean} identification.authorized
 * @property {string} ip
 * @property {ApiDiscoveryDeviceFirmware} firmware
 * @property {Object.<string, boolean>} flags
 * @property {Object} connect
 * @property {boolean} connect.isSupported
 * @property {string} connect.status
 * @property {?string} connect.progress
 * @property {?string} connect.error
 * @property {Object} authentication
 * @property {?string} authentication.status
 * @property {?string} authentication.error
 */

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {ApiDiscoveryDeviceFirmware}
 */
const toApiDiscoveryDeviceFirmware = (cmDiscoveryDevice) => {
  if (isNull(cmDiscoveryDevice.firmware)) { return null }

  return {
    current: cmDiscoveryDevice.firmware.current,
    latest: cmDiscoveryDevice.firmware.latest,
    compatible: cmDiscoveryDevice.firmware.compatible,
    semver: {
      current: toApiSemver(cmDiscoveryDevice.firmware.semver.current),
      latest: toApiSemver(cmDiscoveryDevice.firmware.semver.latest),
    },
  };
};

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Object.<string, boolean>}
 */
const toApiStatusFlags = cmDiscoveryDevice => ({
  [DiscoveryDeviceFlagsEnum.CanAuthenticate]: (
    cmDiscoveryDevice.isSupported &&
    cmDiscoveryDevice.connectStatus !== DiscoveryConnectStatusEnum.Connected
  ),
  [DiscoveryDeviceFlagsEnum.CanConnect]: (
    cmDiscoveryDevice.isSupported &&
    cmDiscoveryDevice.authenticationStatus === ProgressStatusEnum.Success &&
    cmDiscoveryDevice.connectStatus === DiscoveryConnectStatusEnum.NotConnected
  ),
  [DiscoveryDeviceFlagsEnum.UnsupportedDevice]: !cmDiscoveryDevice.isSupported,
  [DiscoveryDeviceFlagsEnum.UnsupportedFirmware]: !cmDiscoveryDevice.isFirmwareSupported,
  [DiscoveryDeviceFlagsEnum.MissingCredentials]: (
    cmDiscoveryDevice.connectStatus !== DiscoveryConnectStatusEnum.Connected && !cmDiscoveryDevice.hasCredentials
  ),
  [DiscoveryDeviceFlagsEnum.Error]: (
    cmDiscoveryDevice.authenticationError !== null || cmDiscoveryDevice.connectError !== null
  ),
});

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {ApiDiscoveryDevice}
 */
const toApiDiscoveryDevice = cmDiscoveryDevice => ({
  identification: {
    id: cmDiscoveryDevice.id,
    firmwareVersion: cmDiscoveryDevice.firmwareVersion,
    platformId: cmDiscoveryDevice.platformId,
    model: cmDiscoveryDevice.model,
    name: cmDiscoveryDevice.name,
    mac: cmDiscoveryDevice.mac,
    type: cmDiscoveryDevice.type,
    category: cmDiscoveryDevice.category,
    siteId: cmDiscoveryDevice.siteId,
    authorized: cmDiscoveryDevice.authorized,
    uptime: cmDiscoveryDevice.uptime,
  },
  ip: cmDiscoveryDevice.ip,
  firmware: toApiDiscoveryDeviceFirmware(cmDiscoveryDevice),
  flags: toApiStatusFlags(cmDiscoveryDevice),
  connect: {
    status: cmDiscoveryDevice.connectStatus,
    progress: cmDiscoveryDevice.connectProgress,
    error: cmDiscoveryDevice.connectError,
  },
  authentication: {
    status: cmDiscoveryDevice.authenticationStatus,
    error: cmDiscoveryDevice.authenticationError,
  },
});

/**
 * @function toApiDiscoveryDeviceList
 * @param {CorrespondenceDiscoveryDevice[]} cmDiscoveryDeviceList
 * @return {ApiDiscoveryDevice[]}
 */
const toApiDiscoveryDeviceList = map(toApiDiscoveryDevice);

module.exports = {
  toDbDiscoveryDevice,
  toApiDiscoveryDevice,
  toApiDiscoveryDeviceList,

  safeToDbDiscoveryDevice: liftMapper(toDbDiscoveryDevice),
  safeToApiDiscoveryDevice: liftMapper(toApiDiscoveryDevice),
  safeToApiDiscoveryDeviceList: liftMapper(toApiDiscoveryDeviceList),
};
