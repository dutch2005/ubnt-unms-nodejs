'use strict';

const YAML = require('yamljs');
const path = require('path');
const { assoc } = require('ramda');

/*
 * Hapijs routes definition
 */

function registerRoutes(server, options) {
  server.plugins.views.addViewManager(server);

  let swaggerSpec = YAML.load(path.join(__dirname, 'public/swagger_v2.yaml'));
  if (options.demo) {
    swaggerSpec = assoc('basePath', '/v2.0', swaggerSpec);
  }

  server.route({
    method: 'GET',
    path: '/api-docs',
    config: {
      auth: false,
    },
    handler: (request, reply) => {
      reply.view('api-docs', { swaggerSpec: JSON.stringify(swaggerSpec) });
    },
  });

  server.route({
    method: 'GET',
    path: '/api-docs-v2',
    config: {
      auth: false,
    },
    handler: (request, reply) => {
      reply.view('api-docs', { swaggerUrl: '/swagger.json' });
    },
  });
}

module.exports = {
  registerRoutes,
};
