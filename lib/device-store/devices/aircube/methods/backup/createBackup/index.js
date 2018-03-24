'use strict';

const { gte } = require('semver');

const createBackup$1d1d2 = require('./createBackup-1.1.2');

module.exports = (sysInfo) => {
  if (gte(sysInfo.firmwareVersion, '1.1.2-dev')) {
    return createBackup$1d1d2;
  }

  return null;
};
