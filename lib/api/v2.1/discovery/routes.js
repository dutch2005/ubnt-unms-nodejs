'use strict';

const validation = require('../../../validation');

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/discovery',
    handler(request, reply) {
      const userId = request.token.userId;

      reply(
        service.discoveryResult(userId)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/discovery',
    handler(request, reply) {
      const userId = request.token.userId;

      reply(
        service.removeDiscoveryResult(userId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/discovery/start',
    config: {
      validate: {
        payload: validation.discoveryRequest,
      },
    },
    handler(request, reply) {
      const userId = request.token.userId;

      reply(
        service.startDiscoveryScan(userId, request.payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/discovery/stop',
    handler(request, reply) {
      const userId = request.token.userId;

      reply(
        service.stopDiscoveryScan(userId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/discovery/credentials',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: validation.discoveryCredentials,
      },
    },
    handler(request, reply) {
      const { credentials, devices: deviceIds } = request.payload;
      const userId = request.token.userId;

      reply(
        service.assignCredentials(userId, deviceIds, credentials)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/discovery/connect',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: validation.discoveryConnect,
      },
    },
    handler(request, reply) {
      const { devices: deviceIds, preferences } = request.payload;
      const userId = request.token.userId;

      reply(
        service.connectDevices(userId, deviceIds, preferences)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/discovery/suggest-ip-range',
    handler(request, reply) {
      reply(
        service.suggestIpRange()
      );
    },
  });
}

module.exports = {
  registerRoutes,
};

