'use strict';

const { gte } = require('semver');

const applyBackup$1d1d2 = require('./applyBackup-1.1.2');

module.exports = (sysInfo) => {
  if (gte(sysInfo.firmwareVersion, '1.1.2-dev')) {
    return applyBackup$1d1d2;
  }

  return null;
};
