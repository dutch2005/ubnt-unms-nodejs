'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { identity } = require('lodash/fp');
const { when, pipeP } = require('ramda');
const fs = require('fs');

const ubus = require('../protocol/ubus');
const { authenticate } = require('../authentication/aircube');
const { upgradeFirmwareIfNeeded } = require('./generic');
const { toMs, pathNotEq, rejectP } = require('../../util');
const { DiscoveryConnectProgressEnum } = require('../../enums');

const FIRMWARE_UPGRADE_TIMEOUT = toMs('minute', 5);
const RECONNECT_DELAY = toMs('second', 10);

const POLLING_DELAY = toMs('second', 1);
const POLLING_COUNT = 3;

const handleFirmwareTestError = when(pathNotEq(['code'], 0), () => rejectP(new Error('Firmware not compatible')));

const tryReconnect = connection => Observable.defer(() => connection.poll())
  .retryWhen(errors => errors.delay(RECONNECT_DELAY)) // retry with delay
  .repeatWhen(notifications => notifications.delay(POLLING_DELAY).take(POLLING_COUNT)) // poll multiple times
  .last()
  .mergeMap(() => authenticate(connection));

const upgradeFirmware = firmware => reader(
  (connection) => {
    const uploadFirmwarePromise = connection.request({
      url: '/api/v1/fwupdate',
      method: 'post',
      timeout: FIRMWARE_UPGRADE_TIMEOUT,
      formData: {
        file: fs.createReadStream(firmware.path),
      },
    })
      .then(() => connection.call('rpc-sys', 'upgrade_test', {}))
      .then(handleFirmwareTestError)
      .then(() => connection.call('rpc-sys', 'upgrade_start', {}))
      .catch(error => connection.call('rpc-sys', 'upgrade_clean', {})
        .then(() => rejectP(error)));

    return Observable.fromPromise(uploadFirmwarePromise)
      .mergeMap(() => connection.logout().catch(identity)) // ignore logout error
      .delay(RECONNECT_DELAY)
      .switchMap(() => tryReconnect(connection))
      .timeoutWith(FIRMWARE_UPGRADE_TIMEOUT, Observable.throw(new Error('Firmware upgrade timeout')));
  }
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @return {Reader.<connect~callback>}
 */
const connect = (cmDiscoveryDevice, authCredentials) => reader(
  /**
   * @function connect~callback
   * @param {DiscoveryStatusUpdater} statusUpdater
   * @param {FirmwareDal} firmwareDal
   * @param {Function} connectionStringProvider
   * @return {Observable.<Object>}
   */
  ({ statusUpdater, firmwareDal, connectionStringProvider }) => {
    const { ip: host } = cmDiscoveryDevice;
    const { username, password, httpsPort: port } = authCredentials;

    const upgradeFirmwareIfNeededReader = upgradeFirmwareIfNeeded(upgradeFirmware, cmDiscoveryDevice);

    return Observable.of(ubus.createConnection({ host, port, username, password }))
      .mergeMap(authenticate)
      .mergeMap(connection => upgradeFirmwareIfNeededReader.run({ statusUpdater, firmwareDal, connection }))
      .tapO(() => statusUpdater
        .updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.SettingConnectionString))
      .mergeMap(connection => pipeP(
        () => connection.call('uci', 'rollback', {}).catch(identity), // remove any changes
        () => connection.call('uci', 'set', {
          config: 'udapi_bridge',
          type: 'udapi_bridge',
          name: 'udapi_bridge',
          values: { connection_string: connectionStringProvider() },
        }),
        () => connection.call('uci', 'apply', {})
      )());
  }
);

module.exports = { connect };
