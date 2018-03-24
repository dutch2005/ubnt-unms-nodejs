'use strict';

const { constant } = require('lodash/fp');

const applyBackup = require('../../../../backends/ubridge/methods/backup/applyBackup')();

function applyBackupDelayed(backup) {
  // temporary fix - delay future actions so the config can be applied
  return applyBackup.call(this, backup)
    .delay(5000);
}

module.exports = constant(applyBackupDelayed);
