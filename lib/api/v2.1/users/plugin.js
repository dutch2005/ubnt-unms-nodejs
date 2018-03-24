'use strict';

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');

function register(server, options) {
  const { user } = server.plugins;

  registerRoutes(server, options, user);
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiUsersV2.1',
  version: '1.0.0',
  dependencies: ['user'],
};
