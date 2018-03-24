'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const {
  getInterfaceList, getInterfaceConfig, updateInterfaceConfig, blockInterface, unblockInterface, createVlan,
  createPPPoE, removeInterface, setOspfConfig, unsetOspfConfig,
} = require('./service');
const { DB } = require('../../../db');


function register(server, options) {
  const { deviceStore, eventLog } = server.plugins;
  const getInterfaceListBound = weave(getInterfaceList, { DB, deviceStore });
  const getInterfaceConfigBound = weave(getInterfaceConfig, { DB, deviceStore });
  const createVlanBound = weave(createVlan, { DB, deviceStore });
  const createPPPoEBound = weave(createPPPoE, { DB, deviceStore });
  const updateInterfaceConfigBound = weave(updateInterfaceConfig, { DB, deviceStore });
  const removeInterfaceBound = weave(removeInterface, { deviceStore });
  const blockInterfaceBound = weave(blockInterface, { deviceStore, eventLog });
  const unblockInterfaceBound = weave(unblockInterface, { deviceStore, eventLog });
  const setOspfConfigBound = weave(setOspfConfig, { DB, deviceStore });
  const unsetOspfConfigBound = weave(unsetOspfConfig, { DB, deviceStore });
  const service = {
    getInterfaceList: getInterfaceListBound,
    getInterfaceConfig: getInterfaceConfigBound,
    createVlan: createVlanBound,
    createPPPoE: createPPPoEBound,
    updateInterfaceConfig: updateInterfaceConfigBound,
    removeInterface: removeInterfaceBound,
    blockInterface: blockInterfaceBound,
    unblockInterface: unblockInterfaceBound,
    setOspfConfig: setOspfConfigBound,
    unsetOspfConfig: unsetOspfConfigBound,
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiInterfacesV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'eventLog'],
};
