'use strict';

const { constant, partial } = require('lodash/fp');

const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { getAirMaxBackupWithCrc } = require('../../../../../backups/util');

const backupRequest = partial(rpcRequest, [{ CONFIG: { action: 'save' } }, 'backupConfig', 'sys']);

const BACKUP_TIMEOUT = 180000; // 2 minutes

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<string>}
 */
function createBackup() {
  return this.connection.rpc(backupRequest(), BACKUP_TIMEOUT)
    .pluck('data')
    .map(getAirMaxBackupWithCrc);
}

module.exports = constant(createBackup);

