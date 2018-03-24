'use strict';

const { registerPlugin } = require('../util/hapi');
const { toBackendPaginationPrerequisite } = require('./pagination');

/*
 * Hapijs Plugin definition
 */
function register(server) {
  server.method(toBackendPaginationPrerequisite.name, toBackendPaginationPrerequisite, {
    callback: false,
  });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'utils',
  version: '1.0.0',
  dependencies: [],
};
