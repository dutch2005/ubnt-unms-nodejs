'use strict';

const { constant } = require('lodash/fp');

const { rpcRequest } = require('../../messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {Buffer} backup
 * @return {Observable.<string>}
 */
function applyBackup(backup) {
  return this.connection.rpc(rpcRequest({
    SET: { backup_config_data: backup.toString('hex') },
  }, 'backupConfigApply', 'sys'));
}

module.exports = constant(applyBackup);
