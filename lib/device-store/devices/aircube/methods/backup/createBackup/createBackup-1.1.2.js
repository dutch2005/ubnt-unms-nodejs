'use strict';

const { path, partial } = require('ramda');

const { commandRequest } = require('../../../../../backends/ubridge/messages');
const { getBackupWithCrc } = require('../../../../../../backups/util');

const CMD = 'lua -e "dofile(\'/usr/share/ubnt/config\'); downloadConfig()" | hexdump -v -e \'/1 "%02X"\'';
const BACKUP_TIMEOUT = 180000; // 2 minutes

const backupCommand = partial(commandRequest, [CMD]);

function createBackup() {
  return this.connection.cmd(backupCommand(), BACKUP_TIMEOUT)
    .map(path(['data', 'output', 0]))
    .map(getBackupWithCrc);
}

module.exports = createBackup;
