'use strict';

const { registerPlugin } = require('../util/hapi');
const { MacAesKeyStore } = require('./index');
const handlers = require('./handlers');

/*
 * Hapi plugin definition
 */
function register(server) {
  const { dal, logging, messageHub } = server.plugins;

  const macAesKeyStore = new MacAesKeyStore(dal, logging);

  server.expose({
    remove: macAesKeyStore.remove.bind(macAesKeyStore),
    create: macAesKeyStore.create.bind(macAesKeyStore),
    update: macAesKeyStore.update.bind(macAesKeyStore),
    updateLastSeen: macAesKeyStore.updateLastSeen.bind(macAesKeyStore),
    updateStatus: macAesKeyStore.updateStatus.bind(macAesKeyStore),
    findByMac: macAesKeyStore.findByMac.bind(macAesKeyStore),
    findById: macAesKeyStore.findById.bind(macAesKeyStore),
  });

  messageHub.registerHandlers(handlers);

  return macAesKeyStore.initialize();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'macAesKeyStore',
  version: '1.0.0',
  dependencies: ['dal', 'logging', 'messageHub'],
};
