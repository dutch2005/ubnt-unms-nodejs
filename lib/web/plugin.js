'use strict';

const { registerPlugin } = require('../util/hapi');
const { registerRoutes } = require('./routes');

function register(server, options) {
  const serverContext = {
    updateVersionOverride: null,
  };
  server.bind(serverContext);

  const service = {
    getUpdateVersionOverride: () => serverContext.updateVersionOverride,
  };
  server.expose(service);

  registerRoutes(server, options);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'web',
  version: '1.0.0',
  dependencies: ['views'],
};

