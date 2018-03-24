'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave, weaveLazy } = require('ramda-adjunct');
const { curry, pick } = require('lodash/fp');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const {
  onuList, onuList: { loadData: loadOnuList }, onuDetail, restartOnu,
  removeOnu, resetInterfaceListStatistics, blockOnu, unblockOnu, updateOnu,
} = require('./service');


const lazyConfig = curry((pluginNames, server) => () => pick(pluginNames, server.plugins));


function register(server, options) {
  server.expose('loadOnuList', loadOnuList);

  const { firmwareDal, deviceStore, DB, eventLog } = server.plugins;

  const service = {
    onuList: weaveLazy(onuList, lazyConfig(['apiOltsV2.1', 'deviceStore', 'firmwareDal', 'DB'], server)),
    onuDetail: weave(onuDetail, { deviceStore, firmwareDal, DB }),
    restartOnu: weave(restartOnu, { deviceStore, DB }),
    removeOnu: weave(removeOnu, { deviceStore, DB, eventLog }),
    resetInterfaceListStatistics: weave(resetInterfaceListStatistics, { DB }),
    blockOnu: weave(blockOnu, { deviceStore, DB, firmwareDal }),
    unblockOnu: weave(unblockOnu, { deviceStore, DB, firmwareDal }),
    updateOnu: weave(updateOnu, { deviceStore, DB, firmwareDal }),
    loadOnuList: weave(onuList.loadData, { deviceStore, firmwareDal, DB }),
  };

  server.expose(service);

  return registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiOnusV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'firmwareDal', 'DB', 'eventLog'],
};
