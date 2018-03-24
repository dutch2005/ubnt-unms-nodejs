'use strict';

const validation = require('../../../validation');


/*
 * Hapijs routes definition
 */

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.0/devices/airmaxes/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;

      reply(
        service.airMaxDetail(deviceId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/airmaxes/{id}/stations',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        service.airMaxStations(request.params.id)
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
