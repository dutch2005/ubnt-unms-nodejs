'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const config = require('../../config');
const { collect, collectForDevice, collectForInterfaces, deleteDeviceStatistics } = require('./index');
const handlers = require('./handlers');

function register(server) {
  const { messageHub, DB } = server.plugins;

  const pluginApi = {
    collect: weave(collect, { DB, config }),
    collectForDevice: weave(collectForDevice, { DB, config }),
    collectForInterfaces: weave(collectForInterfaces, { DB, config }),
    deleteDeviceStatistics: weave(deleteDeviceStatistics, { DB, config }),
  };

  server.expose(pluginApi);

  messageHub.registerHandlers(handlers);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'statistics',
  version: '1.0.0',
  dependencies: ['DB', 'messageHub'],
};
