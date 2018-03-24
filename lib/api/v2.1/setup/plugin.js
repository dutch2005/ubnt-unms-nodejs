'use strict';

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');

function register(server, options) {
  registerRoutes(server, options);
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'setup_v2.1',
  version: '1.0.0',
  dependencies: ['auth'],
};
