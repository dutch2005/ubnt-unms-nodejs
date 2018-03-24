'use strict';

/*
 * Hapijs routes definition
 */
const validation = require('../../../validation');

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/devices/eswitches/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        service.eswitchDetail(request.params.id)
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
