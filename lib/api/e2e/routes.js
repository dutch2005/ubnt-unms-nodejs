'use strict';

/*
 * Route definitions
 */

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/e2e/aes-keys',
    config: {
      auth: false,
    },
    handler(request, reply) {
      reply(
        service.getAesKeys()
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/e2e/discovery-results',
    config: {
      auth: false,
    },
    handler(request, reply) {
      reply(
        service.getDiscoveryResults()
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
