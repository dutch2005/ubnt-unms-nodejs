'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { pipeP, chain, curry } = require('ramda');
const { cata } = require('ramda-adjunct');
const fs = require('fs');

const https = require('../../../protocol/https');
const { authenticate } = require('../../../authentication/airmax');
const { upgradeFirmwareIfNeeded } = require('../../generic');
const { DiscoveryConnectProgressEnum } = require('../../../../enums');
const { toMs, rejectP, resolveP } = require('../../../../util');
const { mergeRight } = require('../../../../transformers');
const { fromConfigurationFile, toConfigurationFile } = require('../../../../transformers/discovery/device/airmax');
const { mergeConfiguration } = require('../../../../transformers/discovery/device/airmax/mergers');

const FIRMWARE_UPGRADE_TIMEOUT = toMs('minute', 5);

const RECONNECT_DELAY = toMs('second', 5);

const POLLING_TIMEOUT = toMs('second', 10);
const POLLING_DELAY = toMs('second', 1);
const POLLING_COUNT = 3;

const tryReconnect = (cmDiscoveryDevice, connection) =>
  Observable.defer(() => connection.get('/poll.cgi', { timeout: POLLING_TIMEOUT, headers: connection.headers }))
    .retryWhen(errors => errors.delay(RECONNECT_DELAY)) // retry with delay
    .repeatWhen(notifications => notifications.delay(POLLING_DELAY).take(POLLING_COUNT)) // poll multiple times
    .last()
    .mergeMap(() => authenticate(cmDiscoveryDevice, connection)
  );

const handleFirmwareUploadError = (response) => {
  try {
    const data = JSON.parse(response);
    if (data.code !== 0 || data.err !== 0) {
      return Observable.throw(new Error(data.message));
    }
  } catch (e) {
    return Observable.throw(new Error('Firmware upload failed'));
  }

  return Observable.of(response);
};

const handleFirmwareUpgradeError = (response) => {
  try {
    const data = JSON.parse(response);
    if (data.code !== 0) {
      return Observable.throw(new Error(data.message));
    }
  } catch (e) {
    return Observable.throw(new Error('Firmware upgrade failed'));
  }

  return Observable.of(response);
};

const upgradeFirmware = curry((cmDiscoveryDevice, firmware) => reader(
  connection => Observable.fromPromise(connection.post('/fwupl.cgi', {
    headers: connection.headers,
    timeout: FIRMWARE_UPGRADE_TIMEOUT,
    formData: { fwfile: fs.createReadStream(firmware.path) },
  }))
    .mergeMap(handleFirmwareUploadError)
    .mergeMap(() => connection.post('/fwflash.cgi', { form: { do_update: 1 }, headers: connection.headers }))
    .mergeMap(handleFirmwareUpgradeError)
    .delay(RECONNECT_DELAY)
    .switchMap(() => tryReconnect(cmDiscoveryDevice, connection))
    .timeoutWith(FIRMWARE_UPGRADE_TIMEOUT, Observable.throw(new Error('Firmware upgrade timeout')))
));

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @param {Boolean} ignoreFirmwareUpgrade
 * @return {Reader.<connect~callback>}
 */
const connect = (cmDiscoveryDevice, authCredentials, ignoreFirmwareUpgrade = false) => reader(
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

    const upgradeFirmwareIfNeededReader =
      upgradeFirmwareIfNeeded(upgradeFirmware(cmDiscoveryDevice), cmDiscoveryDevice);

    return Observable.of(https.createConnection({ host, port, username, password }))
      .mergeMap(authenticate(cmDiscoveryDevice))
      .mergeMap((connection) => {
        if (ignoreFirmwareUpgrade) {
          return Observable.of(connection);
        }

        return upgradeFirmwareIfNeededReader.run({ statusUpdater, firmwareDal, connection });
      })
      .tapO(() => statusUpdater
        .updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.SettingConnectionString))
      .mergeMap(connection => pipeP(
        () => connection.get('/getcfg.cgi', { headers: connection.headers }),
        fromConfigurationFile({}),
        chain(mergeRight(mergeConfiguration, Either.of({
          'unms.uri': connectionStringProvider(),
          'unms.uri.changed': connectionStringProvider(),
          'unms.status': 'enabled',
        }))),
        chain(toConfigurationFile),
        cata(rejectP, resolveP),
        configuration => connection.post('/writecfg.cgi', {
          headers: connection.headers,
          formData: {
            cfgData: configuration,
          },
        })
      )());
  }
);

module.exports = connect;
