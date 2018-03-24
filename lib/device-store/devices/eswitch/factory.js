'use strict';

const createDefaultCommDevice = require('../default');

const buildDevice = require('./methods/device/buildDevice');
const restartDevice = require('./methods/device/restartDevice');
const applyBackup = require('./methods/device/applyBackup');

const systemUpgrade = require('./methods/system/upgrade');

const setSetup = require('../../backends/ubridge/methods/unms/setSetup');
const createBackup = require('../../backends/ubridge/methods/backup/createBackup');

const createDevice = (connection, sysInfo) => {
  const commDevice = createDefaultCommDevice(sysInfo, connection);

  Object.assign(commDevice, {
    buildDevice: buildDevice(sysInfo),
    restartDevice: restartDevice(sysInfo),

    setSetup: setSetup(sysInfo),
    createBackup: createBackup(sysInfo),
    applyBackup: applyBackup(sysInfo),

    systemUpgrade: systemUpgrade(sysInfo),
  });

  return commDevice;
};

module.exports = createDevice;
