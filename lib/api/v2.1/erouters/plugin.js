'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { DB } = require('../../../db');
const service = require('./service');
const { registerRoutes } = require('./routes');


function register(server, options) {
  const { deviceStore, firmwareDal, dal } = server.plugins;

  const erouterDetailBound = weave(service.erouterDetail, { DB, deviceStore, firmwareDal, dal });

  const routeListBound = weave(service.routeList, { deviceStore });
  const routeCreateBound = weave(service.routeCreate, { deviceStore });
  const routeUpdateBound = weave(service.routeUpdate, { deviceStore });
  const routeBlockBound = weave(service.routeBlock, { deviceStore });
  const routeUnblockBound = weave(service.routeUnblock, { deviceStore });
  const routeDeleteBound = weave(service.routeDelete, { deviceStore });

  const ospfAreasListBound = weave(service.ospfAreasList, { deviceStore });
  const createOspfAreaBound = weave(service.createOspfArea, { deviceStore });
  const deleteOspfAreaBound = weave(service.deleteOspfArea, { deviceStore });
  const updateOspfAreaBound = weave(service.updateOspfArea, { deviceStore });
  const getOspfConfigBound = weave(service.getOspfConfig, { deviceStore });
  const setOspfConfigBound = weave(service.setOspfConfig, { deviceStore });

  const getDhcpServersListBound = weave(service.getDHCPServersList, { deviceStore });
  const getDHCPServerBound = weave(service.getDHCPServer, { deviceStore });
  const createDHCPServerBound = weave(service.createDHCPServer, { deviceStore });
  const updateDHCPServerBound = weave(service.updateDHCPServer, { deviceStore });
  const deleteDHCPServerBound = weave(service.deleteDHCPServer, { deviceStore });
  const blockDHCPServerBound = weave(service.blockDHCPServer, { deviceStore });
  const unblockDHCPServerBound = weave(service.unblockDHCPServer, { deviceStore });

  const getDHCPLeasesBound = weave(service.getDHCPLeases, { deviceStore });
  const loadDHCPLeasesBound = weave(service.getDHCPLeases.loadData, { deviceStore });
  const createDHCPLeaseBound = weave(service.createDHCPLease, { deviceStore });
  const deleteDHCPLeaseBound = weave(service.deleteDHCPLease, { deviceStore });
  const updateDHCPLeaseBound = weave(service.updateDHCPLease, { deviceStore });

  const eroutersService = {
    erouterDetail: erouterDetailBound,

    routeList: routeListBound,
    routeCreate: routeCreateBound,
    routeUpdate: routeUpdateBound,
    routeBlock: routeBlockBound,
    routeUnblock: routeUnblockBound,
    routeDelete: routeDeleteBound,

    ospfAreasList: ospfAreasListBound,
    createOspfArea: createOspfAreaBound,
    updateOspfArea: updateOspfAreaBound,
    getOspfConfig: getOspfConfigBound,
    setOspfConfig: setOspfConfigBound,
    deleteOspfArea: deleteOspfAreaBound,

    getDHCPServersList: getDhcpServersListBound,
    getDHCPServer: getDHCPServerBound,
    createDHCPServer: createDHCPServerBound,
    updateDHCPServer: updateDHCPServerBound,
    deleteDHCPServer: deleteDHCPServerBound,
    blockDHCPServer: blockDHCPServerBound,
    unblockDHCPServer: unblockDHCPServerBound,

    getDHCPLeases: getDHCPLeasesBound,
    loadDHCPLeases: loadDHCPLeasesBound,
    createDHCPLease: createDHCPLeaseBound,
    deleteDHCPLease: deleteDHCPLeaseBound,
    updateDHCPLease: updateDHCPLeaseBound,
  };

  registerRoutes(server, options, eroutersService);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiERoutersV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'firmwareDal'],
};
