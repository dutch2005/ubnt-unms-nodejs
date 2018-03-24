'use strict';

const createDefaultCommDevice = require('../default');

const buildDevice = require('../../backends/vyatta/methods/device/buildDevice');
const restartDevice = require('../../backends/vyatta/methods/device/restartDevice');

const getSystem = require('../../backends/vyatta/methods/system/getSystem');
const setSystem = require('../../backends/vyatta/methods/system/setSystem');

const setSetup = require('../../backends/ubridge/methods/unms/setSetup');
const createBackup = require('../../backends/ubridge/methods/backup/createBackup');
const applyBackup = require('../../backends/ubridge/methods/backup/applyBackup');

const getServices = require('../../backends/vyatta/methods/services/getServices');
const setServices = require('../../backends/vyatta/methods/services/setServices');

const getInterfaces = require('../../backends/vyatta/methods/interfaces/getInterfaces');
const blockInterface = require('../../backends/vyatta/methods/interfaces/blockInterface');
const unblockInterface = require('../../backends/vyatta/methods/interfaces/unblockInterface');
const createPPPoEInterface = require('./methods/interfaces/createPPPoEInterface');
const createVlanInterface = require('./methods/interfaces/createVlanInterface');
const updateInterface = require('./methods/interfaces/updateInterface');
const deleteInterface = require('./methods/interfaces/deleteInterface');

const getDHCPServers = require('./methods/dhcp/getDHCPServers');
const getDHCPLeases = require('./methods/dhcp/getDHCPLeases');
const blockDHCPServer = require('./methods/dhcp/blockDHCPServer');
const unblockDHCPServer = require('./methods/dhcp/unblockDHCPServer');
const upsertDHCPServer = require('./methods/dhcp/upsertDHCPServer');
const deleteDHCPServer = require('./methods/dhcp/deleteDHCPServer');

const getRoutes = require('../../backends/vyatta/methods/routes/getRoutes');
const blockRoute = require('./methods/routes/blockRoute');
const unblockRoute = require('./methods/routes/unblockRoute');
const createRoute = require('./methods/routes/createRoute');
const updateRoute = require('./methods/routes/updateRoute');
const deleteRoute = require('./methods/routes/deleteRoute');

const getOspfAreas = require('./methods/ospf/getOspfAreas');
const upsertOspfArea = require('./methods/ospf/upsertOspfArea');
const deleteOspfArea = require('./methods/ospf/deleteOspfArea');
const getOspfConfig = require('./methods/ospf/getOspfConfig');
const setOspfConfig = require('./methods/ospf/setOspfConfig');

/**
 * @param {WebSocketConnection} connection
 * @param {CorrespondenceSysInfo} sysInfo
 * @return {CommDevice}
 */
const createCommDevice = (connection, sysInfo) => {
  // older versions of udapi-bridge won't send deviceId!
  const commDevice = createDefaultCommDevice(sysInfo, connection);

  Object.assign(commDevice, {
    buildDevice: buildDevice(sysInfo),
    restartDevice: restartDevice(sysInfo),

    setSetup: setSetup(sysInfo),
    createBackup: createBackup(sysInfo),
    applyBackup: applyBackup(sysInfo),

    getSystem: getSystem(sysInfo),
    setSystem: setSystem(sysInfo),

    getServices: getServices(sysInfo),
    setServices: setServices(sysInfo),

    getInterfaces: getInterfaces(sysInfo),
    blockInterface: blockInterface(sysInfo),
    unblockInterface: unblockInterface(sysInfo),
    createPPPoEInterface: createPPPoEInterface(sysInfo),
    createVlanInterface: createVlanInterface(sysInfo),
    updateInterface: updateInterface(sysInfo),
    deleteInterface: deleteInterface(sysInfo),

    getDHCPServers: getDHCPServers(sysInfo),
    getDHCPLeases: getDHCPLeases(sysInfo),
    blockDHCPServer: blockDHCPServer(sysInfo),
    unblockDHCPServer: unblockDHCPServer(sysInfo),
    upsertDHCPServer: upsertDHCPServer(sysInfo),
    deleteDHCPServer: deleteDHCPServer(sysInfo),

    getRoutes: getRoutes(sysInfo),
    blockRoute: blockRoute(sysInfo),
    unblockRoute: unblockRoute(sysInfo),
    createRoute: createRoute(sysInfo),
    updateRoute: updateRoute(sysInfo),
    deleteRoute: deleteRoute(sysInfo),

    getOspfAreas: getOspfAreas(sysInfo),
    upsertOspfArea: upsertOspfArea(sysInfo),
    deleteOspfArea: deleteOspfArea(sysInfo),
    getOspfConfig: getOspfConfig(sysInfo),
    setOspfConfig: setOspfConfig(sysInfo),
  });

  return commDevice;
};

module.exports = createCommDevice;
