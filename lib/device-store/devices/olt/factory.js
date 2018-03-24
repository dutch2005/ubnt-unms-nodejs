'use strict';

const createDefaultCommDevice = require('../default');

const buildDevice = require('../../backends/vyatta/methods/device/buildDevice');
const restartDevice = require('../../backends/vyatta/methods/device/restartDevice');

const setSetup = require('../../backends/ubridge/methods/unms/setSetup');
const createBackup = require('../../backends/ubridge/methods/backup/createBackup');
const applyBackup = require('../../backends/ubridge/methods/backup/applyBackup');

const getRoutes = require('../../backends/vyatta/methods/routes/getRoutes');

const getSystem = require('../../backends/vyatta/methods/system/getSystem');
const setSystem = require('../../backends/vyatta/methods/system/setSystem');

const getServices = require('../../backends/vyatta/methods/services/getServices');
const setServices = require('../../backends/vyatta/methods/services/setServices');

const getInterfaces = require('../../backends/vyatta/methods/interfaces/getInterfaces');
const blockInterface = require('../../backends/vyatta/methods/interfaces/blockInterface');
const unblockInterface = require('../../backends/vyatta/methods/interfaces/unblockInterface');
const updateInterface = require('./methods/interfaces/updateInterface');

const getOnuList = require('./methods/onu/getOnuList');
const getOnuConfigList = require('./methods/onu/getOnuConfigList');
const blockOnu = require('./methods/onu/blockOnu');
const unblockOnu = require('./methods/onu/unblockOnu');
const restartOnu = require('./methods/onu/restartOnu');
const updateOnu = require('./methods/onu/updateOnu');
const upgradeOnu = require('./methods/onu/upgradeOnu');

const getOnuPolicies = require('./methods/onuPolicies/getOnuPolicies');
const setOnuPolicies = require('./methods/onuPolicies/setOnuPolicies');

const getOnuProfiles = require('./methods/onuProfiles/getOnuProfiles');
const createOnuProfile = require('./methods/onuProfiles/createOnuProfile');
const updateOnuProfile = require('./methods/onuProfiles/updateOnuProfile');
const deleteOnuProfile = require('./methods/onuProfiles/deleteOnuProfile');

const createDevice = (connection, sysInfo) => {
  // older versions of udapi-bridge won't send deviceId!
  const commDevice = createDefaultCommDevice(sysInfo, connection);

  Object.assign(commDevice, {
    buildDevice: buildDevice(sysInfo),
    restartDevice: restartDevice(sysInfo),

    setSetup: setSetup(sysInfo),
    createBackup: createBackup(sysInfo),
    applyBackup: applyBackup(sysInfo),

    getRoutes: getRoutes(sysInfo),

    getSystem: getSystem(sysInfo),
    setSystem: setSystem(sysInfo),

    getServices: getServices(sysInfo),
    setServices: setServices(sysInfo),

    getInterfaces: getInterfaces(sysInfo),
    blockInterface: blockInterface(sysInfo),
    unblockInterface: unblockInterface(sysInfo),
    updateInterface: updateInterface(sysInfo),

    getOnuList: getOnuList(sysInfo),
    getOnuConfigList: getOnuConfigList(sysInfo),
    blockOnu: blockOnu(sysInfo),
    unblockOnu: unblockOnu(sysInfo),
    restartOnu: restartOnu(sysInfo),
    updateOnu: updateOnu(sysInfo),
    upgradeOnu: upgradeOnu(sysInfo),

    getOnuPolicies: getOnuPolicies(sysInfo),
    setOnuPolicies: setOnuPolicies(sysInfo),

    getOnuProfiles: getOnuProfiles(sysInfo),
    createOnuProfile: createOnuProfile(sysInfo),
    updateOnuProfile: updateOnuProfile(sysInfo),
    deleteOnuProfile: deleteOnuProfile(sysInfo),
  });

  return commDevice;
};

module.exports = createDevice;
