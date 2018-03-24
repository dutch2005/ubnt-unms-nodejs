'use strict';

const { DB } = require('./index');
const { registerPlugin } = require('../util/hapi');

/*
 * Hapijs Plugin definition
 */
function register(server) {
  server.expose(DB);

  return DB.initialize();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'DB',
  version: '1.0.0',
  dependencies: [],
};
