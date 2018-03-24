'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { contains, isEmpty } = require('lodash/fp');
const { pipeP, chain } = require('ramda');
const { cata, stubUndefined } = require('ramda-adjunct');
const cheerio = require('cheerio');
const fs = require('fs');

const https = require('../../protocol/https');
const { authenticate } = require('../../authentication/airmax/airmax-legacy');
const { upgradeFirmwareIfNeeded } = require('../generic');
const { DiscoveryConnectProgressEnum } = require('../../../enums');
const { toMs, rejectP, resolveP } = require('../../../util');
const { mergeRight } = require('../../../transformers');
const { fromConfigurationFile, toConfigurationFile } = require('../../../transformers/discovery/device/airmax');
const { mergeConfiguration } = require('../../../transformers/discovery/device/airmax/mergers');

const FIRMWARE_UPGRADE_TIMEOUT = toMs('minute', 5);

const RECONNECT_DELAY = toMs('second', 5);

const POLLING_TIMEOUT = toMs('second', 10);
const POLLING_DELAY = toMs('second', 3);
const POLLING_COUNT = 3;

const fetchToken = connection => Observable.fromPromise(connection.get('/system.cgi'))
  .map((html) => {
    const token = cheerio('input[name="token"]', html).attr('value');
    if (isEmpty(token)) {
      return stubUndefined(); // some firmware versions don't have token
    }

    return token;
  });

const tryReconnect = connection => Observable.defer(() => connection.get('/poll.cgi', { timeout: POLLING_TIMEOUT }))
  .retryWhen(errors => errors.delay(RECONNECT_DELAY)) // retry with delay
  .repeatWhen(notifications => notifications.delay(POLLING_DELAY).take(POLLING_COUNT)) // poll multiple times
  .last()
  .mergeMap(() => authenticate(connection));

const handleFirmwareUploadError = (response) => {
  if (!contains('id="msg_body"', response)) {
    return rejectP(new Error('Firmware upload failed'));
  }

  return resolveP(response);
};

const handleFirmwareUpgradeError = (response) => {
  if (!contains('class="popup"', response)) {
    return rejectP(new Error('Firmware upgrade failed to start'));
  }

  return resolveP(response);
};

const handleConfigurationError = (response) => {
  if (!contains('id="msg_body"', response)) {
    return rejectP(new Error('Writing device configuration failed'));
  }

  return resolveP(response);
};

const upgradeFirmware = firmware => reader(
  connection => fetchToken(connection)
    .mergeMap(token => Observable.defer(pipeP(
      () => connection.post('/system.cgi', {
        timeout: FIRMWARE_UPGRADE_TIMEOUT,
        formData: {
          fwupload: 'Upload',
          token,
          action: 'fwupload',
          fwfile: fs.createReadStream(firmware.path),
        },
      }),
      handleFirmwareUploadError,
      () => connection.post('/fwflash.cgi', { formData: { token } }),
      handleFirmwareUpgradeError
    )))
    .delay(RECONNECT_DELAY)
    .switchMap(() => tryReconnect(connection))
    .timeoutWith(FIRMWARE_UPGRADE_TIMEOUT, Observable.throw(new Error('Firmware upgrade timeout')))
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

    return Observable.of(https.createConnection({ host, port, username, password }))
      .mergeMap(authenticate)
      .mergeMap(connection => upgradeFirmwareIfNeededReader.run({ statusUpdater, firmwareDal, connection }))
      .tapO(() => statusUpdater
        .updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.SettingConnectionString))
      .mergeMap(connection => fetchToken(connection)
        .mergeMap(token => pipeP(
          () => connection.get('/getcfg.sh?.'),
          fromConfigurationFile({}),
          chain(mergeRight(mergeConfiguration, Either.of({
            'unms.uri': connectionStringProvider(),
            'unms.status': 'enabled',
          }))),
          chain(toConfigurationFile),
          cata(rejectP, resolveP),
          configuration => connection.post('/system.cgi', {
            formData: {
              token,
              cfgfile: {
                value: configuration,
                options: {
                  filename: 'cfg.txt',
                  contentType: 'text/plain',
                },
              },
              cfgupload: 'Upload',
              action: 'cfgupload',
            },
          }),
          handleConfigurationError,
          () => connection.get('/apply.cgi')
        )())
      );
  }
);

module.exports = connect;
