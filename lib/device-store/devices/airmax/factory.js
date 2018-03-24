'use strict';

const createDefaultCommDevice = require('../default');

const buildDevice = require('./methods/device/buildDevice');
const restartDevice = require('./methods/device/restartDevice');

const getStations = require('./methods/stations/getStations');

const setSetup = require('../../backends/ubridge/methods/unms/setSetup');
const createBackup = require('./methods/backup/createBackup');
const applyBackup = require('./methods/backup/applyBackup');

const createDevice = (connection, sysInfo) => {
  const commDevice = createDefaultCommDevice(sysInfo, connection);

  Object.assign(commDevice, {
    buildDevice: buildDevice(sysInfo),
    restartDevice: restartDevice(sysInfo),

    setSetup: setSetup(sysInfo),
    createBackup: createBackup(sysInfo),
    applyBackup: applyBackup(sysInfo),

    getStations: getStations(sysInfo),
  });

  return commDevice;
};

module.exports = createDevice;
