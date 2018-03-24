'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { pipeP } = require('ramda');
const { trim } = require('lodash/fp');
const fs = require('fs');
const cheerio = require('cheerio');

const https = require('../protocol/https');
const { authenticate } = require('../authentication/eswitch');
const { upgradeFirmwareIfNeeded } = require('./generic');
const { DiscoveryConnectProgressEnum } = require('../../enums');
const { toMs } = require('../../util');

const FIRMWARE_UPGRADE_TIMEOUT = toMs('minute', 10);

const RECONNECT_DELAY = toMs('second', 5);

const POLLING_TIMEOUT = toMs('second', 10);
const POLLING_DELAY = toMs('second', 4);
const POLLING_COUNT = 3;

const RESET_URL = '/htdocs/pages/base/sys_reset.lsp';
const UNMS_CONFIG_URL = '/htdocs/pages/base/ubnt_unms_cfg.lsp';
const SAVE_CONFIG_URL = '/htdocs/lua/ajax/save_cfg.lua?save=1';
const UPLOAD_URL = '/htdocs/lua/ajax/file_download_ajax.lua?protocol=6&imageType=0';
const UPLOAD_PROGRESS_URL = '/htdocs/lua/ajax/file_transfer_ajax.lua?json=1';
const POLL_URL = '/htdocs/login/login.lsp';
const LOGOUT_URL = '/htdocs/pages/main/logout.lsp';

const tryReconnect = connection => Observable.defer(() => connection.get(POLL_URL, { timeout: POLLING_TIMEOUT }))
  .retryWhen(errors => errors.delay(RECONNECT_DELAY)) // retry with delay
  .repeatWhen(notifications => notifications.delay(POLLING_DELAY).take(POLLING_COUNT)) // poll multiple times
  .last()
  .mergeMap(() => authenticate(connection));

const handleFirmwareUploadError = (response) => {
  try {
    const $ = cheerio.load(response);
    const data = JSON.parse($('textarea').text());
    if (data.successful !== true || data.errorMsgs !== '') {
      return Observable.throw(new Error(trim(data.errorMsgs)));
    }
  } catch (e) {
    return Observable.throw(new Error('Firmware upload failed'));
  }

  return Observable.of(response);
};

const restartDevice = connection => Observable.defer(() => connection.post(RESET_URL, {
  timeout: POLLING_TIMEOUT,
  formData: {
    reload_in_d: 0,
    reload_in_h: 0,
    reload_in_m: 0,
    b_form1_clicked: 'b_form1_reset_no_core',
  },
}))
  .catch(() => Observable.of(connection)); // ignore errors because device might not respond because of restart

const firmwareUploadEnded = (data) => {
  try {
    return data.progressVal === 100 && data.xferInProgress === 0;
  } catch (e) {
    throw new Error('Firmware upload failed');
  }
};

const waitForUploadFinish = connection => Observable.defer(() => connection.get(UPLOAD_PROGRESS_URL, { json: true }))
  .first(firmwareUploadEnded)
  .retryWhen(errors => errors.delay(POLLING_DELAY));

const upgradeFirmware = firmware => reader(
  connection => Observable.fromPromise(connection.post(UPLOAD_URL, {
    timeout: FIRMWARE_UPGRADE_TIMEOUT,
    formData: {
      'file_type_sel[]': 'active_code',
      transfer_file: fs.createReadStream(firmware.path),
      orig_file_name: 'firmware',
      optDSV: 0,
    },
  }))
    .mergeMap(handleFirmwareUploadError)
    .mergeMapTo(waitForUploadFinish(connection))
    .mergeMapTo(restartDevice(connection))
    .delay(POLLING_TIMEOUT)
    .switchMapTo(tryReconnect(connection))
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
      .mergeMap(connection => pipeP(
        () => connection.post(UNMS_CONFIG_URL, {
          formData: {
            'unms_mode_sel[]': 'enable',
            unms_key: connectionStringProvider(),
            b_form1_submit: 'Submit',
            b_form1_clicked: 'b_form1_submit',
          },
        }),
        () => connection.post(SAVE_CONFIG_URL),
        () => connection.get(LOGOUT_URL)
      )());
  }
);

module.exports = { connect };
