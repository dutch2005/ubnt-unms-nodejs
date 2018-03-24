'use strict';

// const { bindAll } = require('lodash/fp');

const { registerPlugin } = require('../util/hapi');
const { DataLinkStore } = require('./index');
// const handlers = require('./handlers');

/*
 * Hapi plugin definition
 */
function register(server) {
  const { dal } = server.plugins;

  const dataLinkStore = new DataLinkStore(dal);

  // server.expose(bindAll([
  //   'remove', 'save', 'update', 'findById',
  // ], dataLinkStore));
  //
  // messageHub.registerHandlers(handlers);
  return dataLinkStore.initialize();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'dataLink',
  version: '1.0.0',
  dependencies: ['dal', 'messageHub'],
};
