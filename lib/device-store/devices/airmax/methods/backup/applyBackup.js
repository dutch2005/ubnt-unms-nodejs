'use strict';

const { constant } = require('lodash/fp');

const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { unzipAirMaxBackup } = require('../../../../../backups/util');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {Buffer} backup
 * @return {Observable.<string>}
 */
function applyBackup(backup) {
  return this.connection.rpc(rpcRequest({
    SET: { backup_config_data: unzipAirMaxBackup(backup).toString('hex') },
  }, 'backupConfigApply', 'sys'));
}

module.exports = constant(applyBackup);
