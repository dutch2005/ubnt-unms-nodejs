'use strict';

const aguid = require('aguid');
const { pathOr } = require('ramda');

const { liftParser } = require('../index');

/**
 * @typedef {Object} CorrespondenceMobileDevice
 * @prop {string} id Device ID - may be null when not saved to DB
 * @prop {string} userId User ID
 * @prop {string} name Device Name
 * @prop {!enums.MobileDevicePlatformEnum} platform Mobile device platform (ios|android)
 * @prop {string} deviceToken Device Registration Token
 * @prop {?string} deviceKey Push notification service device key
 * @prop {?string} timestamp Creation timestamp - may be null when not saved to DB
 */

/**
 * Parse API mobile device
 *
 * @sig (Object, Object) -> Object
 * @function parseApiMobileDevice
 * @name parseApiMobileDevice
 * @param {!Object} auxiliaries
 * @param {!Object} apiMobileDevice
 * @return {!CorrespondenceMobileDevice}
 */
const parseApiMobileDevice = (auxiliaries, apiMobileDevice) => ({
  id: pathOr(aguid(), ['id'], apiMobileDevice),
  userId: auxiliaries.userId,
  name: pathOr(null, ['name'], apiMobileDevice),
  platform: pathOr(null, ['platform'], apiMobileDevice),
  deviceToken: pathOr(null, ['deviceToken'], apiMobileDevice),
  deviceKey: null,
  timestamp: null,
});

/**
 * Parse DB mobile device
 *
 * @sig parseDbMobileDevice :: (Object, Object) -> Object
 * @function parseDbMobileDevice
 * @name parseDbMobileDevice
 * @param {!Object} auxiliaries
 * @param {!Object} dbMobileDevice
 * @return {!CorrespondenceMobileDevice}
 */
const parseDbMobileDevice = (auxiliaries, dbMobileDevice) => ({
  id: dbMobileDevice.id,
  userId: dbMobileDevice.user_id,
  name: dbMobileDevice.name,
  platform: dbMobileDevice.platform,
  deviceToken: dbMobileDevice.token,
  deviceKey: dbMobileDevice.device_key,
  timestamp: dbMobileDevice.timestamp,
});

module.exports = {
  parseApiMobileDevice,
  parseDbMobileDevice,

  safeParseApiMobileDevice: liftParser(parseApiMobileDevice),
  safeParseDbMobileDevice: liftParser(parseDbMobileDevice),
};
