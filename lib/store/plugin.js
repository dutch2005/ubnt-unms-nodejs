'use strict';

const { registerPlugin } = require('../util/hapi');
const { set, get, push, unset } = require('./index');


/*
 * Hapi plugin definition
 */
function register(server) {
  server.expose({
    // low level api
    set,
    get,
    push,
    unset,
    // TODO(vladimir.gorej@gmail.com): high level api can be implemented here. CQRS pattern would be suitable here
  });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'store',
  version: '1.0.0',
  dependencies: [],
};
