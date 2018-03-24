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

class SwitchFlowException extends Error {}

const tryReconnect = connection =>
  Observable.defer(() => connection.get('/poll.cgi', { timeout: POLLING_TIMEOUT }))
    .retryWhen(errors => errors.delay(RECONNECT_DELAY)) // retry with delay
    .repeatWhen(notifications => notifications.delay(POLLING_DELAY).take(POLLING_COUNT)) // poll multiple times
    .last();

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

const switchFlow = curry((cmDiscoveryDevice, firmware, conn) => {
  const version = firmware.semver;

  if (version.major === 8 && version.minor >= 5) {
    // BEWARE MUTATION - hack to ensure correct auth method is selected
    // eslint-disable-next-line no-param-reassign
    cmDiscoveryDevice.firmwareVersion = version.raw;
    return Observable.throw(new SwitchFlowException());
  }
  return Observable.of(conn);
});

const upgradeFirmware = curry((cmDiscoveryDevice, firmware) => reader(
  connection => Observable.fromPromise(connection.post('/fwupl.cgi', {
    timeout: FIRMWARE_UPGRADE_TIMEOUT,
    formData: { fwfile: fs.createReadStream(firmware.path) },
  }))
    .mergeMap(handleFirmwareUploadError)
    .mergeMap(() => connection.post('/fwflash.cgi', { form: { do_update: 1 } }))
    .mergeMap(handleFirmwareUpgradeError)
    .delay(RECONNECT_DELAY)
    .switchMap(() => tryReconnect(connection))
    .mergeMap(switchFlow(cmDiscoveryDevice, firmware))
    .mergeMap(() => authenticate(cmDiscoveryDevice, connection))
    .timeoutWith(FIRMWARE_UPGRADE_TIMEOUT, Observable.throw(new Error('Firmware upgrade timeout')))
));

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

    const upgradeFirmwareIfNeededReader =
      upgradeFirmwareIfNeeded(upgradeFirmware(cmDiscoveryDevice), cmDiscoveryDevice);

    return Observable.of(https.createConnection({ host, port, username, password }))
      .mergeMap(authenticate(cmDiscoveryDevice))
      .mergeMap(connection => upgradeFirmwareIfNeededReader.run({ statusUpdater, firmwareDal, connection }))
      .tapO(() => statusUpdater
        .updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.SettingConnectionString))
      .mergeMap(connection => pipeP(
        () => connection.get('/getcfg.sh?.'),
        fromConfigurationFile({}),
        chain(mergeRight(mergeConfiguration, Either.of({
          'unms.uri': connectionStringProvider(),
          'unms.uri.changed': connectionStringProvider(),
          'unms.status': 'enabled',
        }))),
        chain(toConfigurationFile),
        cata(rejectP, resolveP),
        configuration => connection.post('/writecfg.cgi', {
          formData: {
            cfgData: configuration,
          },
        })
      )());
  }
);

connect.SwitchFlowException = SwitchFlowException;

module.exports = connect;

