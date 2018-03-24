'use strict';

const { liftParser } = require('../../index');

/**
 * @typedef {Object} ApiUnmsSettings
 * @property {boolean} overrideGlobal
 * @property {string} devicePingAddress
 * @property {number} devicePingIntervalNormal
 * @property {number} devicePingIntervalOutage
 * @property {DeviceTransmissionProfileEnum} deviceTransmissionProfile
 */

/**
 * @typedef {Object} cmUnmsSettings
 * @property {boolean} overrideGlobal
 * @property {string} devicePingAddress
 * @property {number} devicePingIntervalNormal
 * @property {number} devicePingIntervalOutage
 * @property {DeviceTransmissionProfileEnum} deviceTransmissionProfile
 */

// parseUnmsSettings :: Object -> Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseUnmsSettings = (auxiliaries, cmDevice) => ({
  overrideGlobal: cmDevice.unmsSettings.overrideGlobal,
  devicePingAddress: cmDevice.unmsSettings.devicePingAddress,
  devicePingIntervalNormal: cmDevice.unmsSettings.devicePingIntervalNormal,
  devicePingIntervalOutage: cmDevice.unmsSettings.devicePingIntervalOutage,
  deviceTransmissionProfile: cmDevice.unmsSettings.deviceTransmissionProfile,
});

// parseApiUnmsSettings :: Object -> Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseApiUnmsSettings = (auxiliaries, apiUnmsSettings) => ({
  overrideGlobal: apiUnmsSettings.overrideGlobal,
  devicePingAddress: apiUnmsSettings.devicePingAddress,
  devicePingIntervalNormal: apiUnmsSettings.devicePingIntervalNormal,
  devicePingIntervalOutage: apiUnmsSettings.devicePingIntervalOutage,
  deviceTransmissionProfile: apiUnmsSettings.deviceTransmissionProfile,
});

module.exports = {
  parseUnmsSettings,
  parseApiUnmsSettings,

  safeParseUnmsSettings: liftParser(parseUnmsSettings),
  safeParseApiUnmsSettings: liftParser(parseApiUnmsSettings),
};
