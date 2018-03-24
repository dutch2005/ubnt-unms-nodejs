'use strict';

const joi = require('joi');

/*
 * Hapijs routes definition
 */

const validation = require('../../../validation');


function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/devices/onus',
    config: {
      validate: {
        query: {
          parentId: validation.deviceId.optional(),
        },
      },
    },
    handler(request, reply) {
      const { parentId } = request.query;

      reply(
        service.onuList(parentId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/onus/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;

      reply(
        service.onuDetail(onuId)
      );
    },
  });

  server.route({
    method: 'PATCH',
    path: '/v2.1/devices/onus/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          name: joi.string().min(2).max(80).required(),
          profile: joi.string().min(1).required(),
          enabled: joi.bool().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;
      const { payload } = request;

      reply(
        service.updateOnu(onuId, payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/onus/{id}/restart',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;

      reply(
        service.restartOnu(onuId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/onus/{id}/block',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;

      reply(
        service.blockOnu(onuId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/onus/{id}/unblock',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;

      reply(
        service.unblockOnu(onuId)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/onus/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;

      reply(
        service.removeOnu(onuId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/onus/{id}/resetstats',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: onuId } = request.params;

      reply(
        service.resetInterfaceListStatistics(onuId)
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
