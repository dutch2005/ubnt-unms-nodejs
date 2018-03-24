'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { isNil } = require('lodash/fp');

const log = require('../../logging');
const { DeviceTypeEnum } = require('../../enums');

const erouterCredentialsCheck = require('./erouter');
const eswitchCredentialsCheck = require('./eswitch');
const oltCredentialsCheck = require('./olt');
const airMaxCredentialsCheck = require('./airmax');
const airCubeCredentialsCheck = require('./aircube');

/**
 * @typedef {Function} AuthenticationCheck
 * @param {CorrespondenceDiscoveryDevice} device
 * @param {AuthCredentials} authCredentials
 * @return {Observable.<CorrespondenceDiscoveryDevice>}
 */

/**
 * @typedef {Object} AuthenticationCheckForDevice
 * @property {AuthenticationCheck} check
 */

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {AuthenticationCheckForDevice}
 */
const credentialsCheckForDevice = (cmDiscoveryDevice) => {
  switch (cmDiscoveryDevice.type) {
    case DeviceTypeEnum.Erouter:
      return erouterCredentialsCheck;
    case DeviceTypeEnum.Eswitch:
      return eswitchCredentialsCheck;
    case DeviceTypeEnum.Olt:
      return oltCredentialsCheck;
    case DeviceTypeEnum.AirMax:
      return airMaxCredentialsCheck;
    case DeviceTypeEnum.AirCube:
      return airCubeCredentialsCheck;
    default:
      return {
        check: () => Observable.throw(new Error('Unsupported device type')),
      };
  }
};

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<performCredentialsCheck~callback>}
 */
const performCredentialsCheck = cmDiscoveryDevice => reader(
  /**
   * @function performCredentialsCheck~callback
   * @param {DiscoveryCredentials} credentials
   * @param {DiscoveryStatusUpdater} statusUpdater
   * @return {Observable<R>}
   */
  ({ credentials, statusUpdater }) => {
    const { userId } = cmDiscoveryDevice;
    const authCredentials = credentials.get(userId, [cmDiscoveryDevice.id, cmDiscoveryDevice.ip]);

    if (authCredentials === null) {
      return statusUpdater.missingCredentials(cmDiscoveryDevice);
    }

    return credentialsCheckForDevice(cmDiscoveryDevice)
      .check(cmDiscoveryDevice, authCredentials)
      .mergeMap(statusUpdater.authenticationSuccessful)
      .catch(statusUpdater.authenticationFailed.bind(null, cmDiscoveryDevice))
      .catch((err) => {
        log.error('Unexpected authenticator error', err);
        return Observable.empty(); // ignore all errors
      });
  }
);

/**
 * @param {DbDiscoveryDevice} dbDiscoveryDevice
 * @return {void}
 */
const requestCredentialsCheck = dbDiscoveryDevice => reader(
  (authenticator) => {
    if (isNil(dbDiscoveryDevice)) { return }
    authenticator.enqueue(`${dbDiscoveryDevice.id}~${dbDiscoveryDevice.userId}`, dbDiscoveryDevice);
  }
);

/**
 * @param {string} deviceId
 * @param {string} userId
 * @return {void}
 */
const cancelCredentialsCheck = (deviceId, userId) => reader(
  authenticator => authenticator.cancel(`${deviceId}~${userId}`)
);

module.exports = { requestCredentialsCheck, cancelCredentialsCheck, performCredentialsCheck };
