'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const scan = require('./scan/scan');
const authentication = require('./authentication');
const connect = require('./connect');
const statusUpdate = require('./status-update');
const guessIpRange = require('./guess-ip-range');
const { CredentialsStore, setCredentials, getCredentials } = require('./credentials');
const { JobQueue, ipRangesSize, publicIpRangesSize } = require('./utils');
const { connectionString: connectionStringProvider } = require('../settings');
const { DB } = require('../db');
const logging = require('../logging');

function register(server) {
  const {
    /** @type {DbDal} */ dal,
    /** @type {FirmwareDal} */ firmwareDal,
    deviceStore,
    macAesKeyStore,
  } = server.plugins;

  dal.discoveryResultRepository.removeAll()
    .catch((err) => { logging.error('Unexpected error during discovery results purge', err) });

  const credentialsStore = new CredentialsStore();
  /**
   * @alias DiscoveryCredentials
   */
  const credentials = {
    /**
     * @function DiscoveryCredentials~set
     * @param {string} userId
     * @param {string} deviceIdOrIp
     * @param {AuthCredentials} credentials
     * @return {void}
     */
    set: weave(setCredentials, credentialsStore),
    /**
     * @function DiscoveryCredentials~get
     * @param {string} userId
     * @param {string[]} deviceIdsOrIps
     * @return {?AuthCredentials}
     */
    get: weave(getCredentials, credentialsStore),
  };

  /**
   * @alias DiscoveryStatusUpdater
   */
  const statusUpdater = {
    /**
     * @function DiscoveryStatusUpdater~missingCredentials
     * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
     * @return {Observable}
     */
    missingCredentials: weave(statusUpdate.missingCredentials, dal),
    /**
     * @function DiscoveryStatusUpdater~authenticationFailed
     * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
     * @param {Error} error
     * @return {Observable}
     */
    authenticationFailed: weave(statusUpdate.authenticationFailed, dal),
    /**
     * @function DiscoveryStatusUpdater~authenticationSuccessful
     * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
     * @return {Observable}
     */
    authenticationSuccessful: weave(statusUpdate.authenticationSuccessful, dal),
    /**
     * @function DiscoveryStatusUpdater~updateConnectProgress
     * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
     * @return {Observable}
     */
    updateConnectProgress: weave(statusUpdate.updateConnectProgress, dal),
    /**
     * @function DiscoveryStatusUpdater~connectSuccessful
     * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
     * @return {Observable}
     */
    connectSuccessful: weave(statusUpdate.connectSuccessful, dal),
    /**
     * @function DiscoveryStatusUpdater~connectFailed
     * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
     * @param {Error} error
     * @return {Observable}
     */
    connectFailed: weave(statusUpdate.connectFailed, dal),
  };

  const authenticatorWorker = weave(authentication.performCredentialsCheck, { dal, credentials, statusUpdater });
  const authenticatorQueue = new JobQueue(authenticatorWorker, 10);
  const authenticator = {
    requestCheck: weave(authentication.requestCredentialsCheck, authenticatorQueue),
    cancelCheck: weave(authentication.cancelCredentialsCheck, authenticatorQueue),
  };

  const scannerWorker = weave(scan.performScan, { dal, DB, deviceStore, credentials, authenticator });
  const scannerQueue = new JobQueue(scannerWorker);
  const scanner = {
    ipRangesSize,
    publicIpRangesSize,
    requestScan: weave(scan.requestScan, scannerQueue),
    cancelScan: weave(scan.cancelScan, scannerQueue),
  };

  const connectWorker = weave(connect.performConnect, {
    firmwareDal, deviceStore, DB, credentials, statusUpdater, macAesKeyStore, connectionStringProvider,
  });
  const connectQueue = new JobQueue(connectWorker, 10);
  const connector = {
    requestConnect: weave(connect.requestConnect, connectQueue),
    cancelConnect: weave(connect.cancelConnect, connectQueue),
  };

  server.expose({
    credentials,
    scanner,
    authenticator,
    connector,
    guessIpRange,
  });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'discovery',
  version: '1.0.0',
  dependencies: ['dal', 'firmwareDal', 'deviceStore', 'macAesKeyStore'],
};

