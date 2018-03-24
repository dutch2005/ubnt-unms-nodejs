'use strict';

const HapiSwagger = require('hapi-swagger');

const { registerPlugin } = require('../util/hapi');
const { registerRoutes } = require('./routes');
const swaggerConfig = require('./swagger-config');

function register(server, options) {
  server.register([{
    register: HapiSwagger,
    options: swaggerConfig,
  }]);

  registerRoutes(server, options);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'api-docs',
  version: '1.0.0',
  dependencies: ['views'],
};

