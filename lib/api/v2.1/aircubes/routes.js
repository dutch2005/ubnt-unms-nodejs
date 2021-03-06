'use strict';

const validation = require('../../../validation');


/*
 * Hapijs routes definition
 */

function registerRoutes(server, options, view) {
  server.route({
    method: 'GET',
    path: '/v2.1/devices/aircubes/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler: view.deviceDetail,
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/aircubes/{id}/stations',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler: view.stations,
  });
}

module.exports = {
  registerRoutes,
};
