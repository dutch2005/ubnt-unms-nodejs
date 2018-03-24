'use strict';

const { Observable } = require('rxjs/Rx');
const { constant, partial, getOr, includes } = require('lodash/fp');
const { pathEq } = require('ramda');

const { MessageNameEnum } = require('../../enums');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { toMs } = require('../../../../../util');

const FIRMWARE_FILE = '/tmp/fw.stk';
const UPLOAD_STATUS_CHECK_DELAY = toMs('seconds', 5);
const REBOOT_DELAY = toMs('seconds', 25);

const isDownloadFailed = includes('*DOWNLOAD FAILED*');
const isDownloadCompleted = includes('*DOWNLOAD COMPLETED*');
const isUpgradeStatsEvent = pathEq(['name'], MessageNameEnum.SystemUpgradeStats);

const systemUpgradeRequest = partial(rpcRequest, [{ file: FIRMWARE_FILE }, 'system-upgrade']);

const uploadScript = firmwareUrl => `#!/bin/sh
FIRMWARE_FILE="${FIRMWARE_FILE}"

die () {
  echo "\${1}"
  rm "$FIRMWARE_FILE"
  exit 0
}

cleanup () {
  rm -- "$0"
}

trap "cleanup" EXIT

curl -k -s -f "${firmwareUrl}" > "$FIRMWARE_FILE" || die "*DOWNLOAD FAILED*"
echo "*DOWNLOAD COMPLETED*"
`;

const trackUploadProgress = (commDevice, stdoutFilename) => Observable
  .defer(() => commDevice.runCommand(`cat ${stdoutFilename}`))
  .repeatWhen(notifications => notifications.delay(UPLOAD_STATUS_CHECK_DELAY))
  .map((commandResult) => {
    const output = getOr('', ['data', 'output'], commandResult);

    if (isDownloadCompleted(output)) {
      return true;
    }

    if (isDownloadFailed(output)) {
      throw new Error('Downloading firmware from device has failed');
    }

    return false;
  })
  .takeWhile(isDone => !isDone);

const trackUpgradeProgress = commDevice => commDevice.connection.messages$
  .filter(isUpgradeStatsEvent)
  .map((upgradeStats) => {
    switch (upgradeStats.data.status) {
      case 'in_progress':
        return false; // not done
      case 'finished':
        return true;
      case 'failed':
      default:
        throw new Error(upgradeStats.data.message);
    }
  })
  .takeWhile(isDone => !isDone);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} firmwareUrl
 * @return {Observable.<SystemUpgradeStats>}
 */
function systemUpgrade(firmwareUrl) {
  const upload$ = this.execScript(uploadScript(firmwareUrl))
    .mergeMap(stdoutFilename => trackUploadProgress(this, stdoutFilename));

  const upgrade$ = this.connection.rpc(systemUpgradeRequest())
    .mergeMap(() => trackUpgradeProgress(this));

  const reboot$ = this.restartDevice()
    .delay(REBOOT_DELAY);

  return Observable.concat(upload$, upgrade$, reboot$);
}

module.exports = constant(systemUpgrade);
