'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { RequestError, StatusCodeError } = require('request-promise-native/errors');
const { isError, defaultTo } = require('lodash/fp');
const httpStatus = require('http-status');

const logger = require('../logging');
const { DiscoveryConnectStatusEnum, DiscoveryConnectProgressEnum, ProgressStatusEnum } = require('../enums');

// TODO(michal.sedlak@ubnt.com): Rethink when i18n implemented
const formatErrorMessage = (error) => {
  if (error instanceof RequestError) {
    if (error.cause.code === 'ECONNREFUSED') {
      return 'HTTPS not available';
    }
    return `Server request failed: ${error.cause.code}`;
  } else if (error instanceof StatusCodeError) {
    return `Server request failed: ${defaultTo(error.statusCode, httpStatus[error.statusCode])}`;
  }

  switch (error.level) {
    case 'client-timeout':
      return 'Connection timeout';
    case 'client-socket':
      return 'Socket failure';
    case 'protocol':
      return 'Protocol failure';
    case 'client-authentication':
      return 'Authentication failed';
    case 'agent':
    case 'client-dns':
    default:
      if (isError(error)) { return error.message }

      logger.error('Unknown error in discovery', error);
      return 'Unknown error';
  }
};

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<missingCredentials~callback>}
 */
const missingCredentials = cmDiscoveryDevice => reader(
  /**
   * @function missingCredentials~callback
   * @param {DbDal} config
   * @return {Observable}
   */
  config => Observable.fromPromise(
    config.discoveryDeviceRepository.update({
      id: cmDiscoveryDevice.id,
      userId: cmDiscoveryDevice.userId,
      connectStatus: DiscoveryConnectStatusEnum.NotConnected,
      connectProgress: null,
      authenticationStatus: ProgressStatusEnum.Failed,
      authenticationError: 'Missing credentials',
    })
  )
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {?Error} error
 * @return {Reader.<authenticationFailed~callback>}
 */
const authenticationFailed = (cmDiscoveryDevice, error) => reader(
  /**
   * @function authenticationFailed~callback
   * @param {DbDal} config
   * @return {Observable}
   */
  config => Observable.fromPromise(
    config.discoveryDeviceRepository.update({
      id: cmDiscoveryDevice.id,
      userId: cmDiscoveryDevice.userId,
      connectStatus: DiscoveryConnectStatusEnum.NotConnected,
      connectProgress: null,
      authenticationStatus: ProgressStatusEnum.Failed,
      authenticationError: formatErrorMessage(error),
    })
  )
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<authenticationSuccessful~callback>}
 */
const authenticationSuccessful = cmDiscoveryDevice => reader(
  /**
   * @function authenticationSuccessful~callback
   * @param {DbDal} config
   * @return {Observable}
   */
  config => Observable.fromPromise(
    config.discoveryDeviceRepository.update({
      id: cmDiscoveryDevice.id,
      userId: cmDiscoveryDevice.userId,
      name: cmDiscoveryDevice.name,
      firmwareVersion: cmDiscoveryDevice.firmwareVersion,
      connectStatus: DiscoveryConnectStatusEnum.NotConnected,
      connectProgress: null,
      connectError: null,
      authenticationStatus: ProgressStatusEnum.Success,
      authenticationError: null,
    })
  )
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {DiscoveryConnectProgressEnum} progressValue
 * @return {Reader.<updateConnectProgress~callback>}
 */
const updateConnectProgress = (cmDiscoveryDevice, progressValue) => reader(
  /**
   * @function updateConnectProgress~callback
   * @param {DbDal} config
   * @return {Promise.<DbDiscoveryDevice>}
   */
  config => Observable.fromPromise(
    config.discoveryDeviceRepository.update({
      id: cmDiscoveryDevice.id,
      userId: cmDiscoveryDevice.userId,
      connectProgress: progressValue,
    })
  )
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<connectSuccessful~callback>}
 */
const connectSuccessful = cmDiscoveryDevice => reader(
  /**
   * @function connectSuccessful~callback
   * @param {DbDal} config
   * @return {Promise.<DbDiscoveryDevice>}
   */
  config => Observable.fromPromise(
    config.discoveryDeviceRepository.update({
      id: cmDiscoveryDevice.id,
      userId: cmDiscoveryDevice.userId,
      connectStatus: DiscoveryConnectStatusEnum.Connected,
      connectProgress: null,
      connectError: null,
      firmwareVersion: cmDiscoveryDevice.firmwareVersion,
    })
  )
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {Error} error
 * @return {Reader.<connectFailed~callback>}
 */
const connectFailed = (cmDiscoveryDevice, error) => reader(
  /**
   * @function connectFailed~callback
   * @param {DbDal} config
   * @return {Promise.<DbDiscoveryDevice>}
   */
  config => Observable.fromPromise(
    config.discoveryDeviceRepository.update({
      id: cmDiscoveryDevice.id,
      userId: cmDiscoveryDevice.userId,
      connectStatus: DiscoveryConnectStatusEnum.NotConnected,
      connectProgress: DiscoveryConnectProgressEnum.Failed,
      connectError: formatErrorMessage(error),
    })
  )
);

module.exports = {
  missingCredentials,
  authenticationFailed,
  authenticationSuccessful,
  updateConnectProgress,
  connectSuccessful,
  connectFailed,
};
