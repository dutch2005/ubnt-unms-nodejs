'use strict';

const joi = require('joi');
const { values } = require('ramda');

const { OnuModeEnum, DeviceStateEnum } = require('../../../enums');
const validation = require('../../../validation');


/*
 * Hapijs routes definition
 */

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/devices/olts',
    handler(request, reply) {
      reply(
        service.oltList()
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/olts/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { id: oltId } = request.params;

      reply(
        service.oltDetail(oltId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/olts/{id}/onu/profiles',
    config: {
      validate: {
        params: {
          id: validation.oltId,
        },
      },
    },
    handler(request, reply) {
      const { id: oltId } = request.params;

      reply(
        service.onuProfileList(oltId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/olts/{id}/onu/profiles',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.oltId,
        },
        payload: {
          name: joi.string().min(1).max(80).required(),
          mode: joi.string().valid(...values(OnuModeEnum)).required(),
          adminPassword: joi.string().min(1).max(12).required(),

          bridge: joi.object({
            nativeVlan: joi.number().required().allow(null),
            includeVlans: joi.array().items(joi.number().min(2).max(4063)).required().allow(null),
          }).required().when('mode', {
            is: OnuModeEnum.Router,
            then: joi.allow(null),
          }),

          router: joi.object({
            ingressRate: joi.number().required().allow(null),
            egressRate: joi.number().required().allow(null),
            wanVlan: joi.number().min(2).max(4063).required().allow(null),
            gateway: joi.string().ip().required(),
            dnsResolver: joi.string().ip().required().allow(null),
            dhcpPool: joi.string().required().allow(null),
            unmsConnString: joi.string().required().allow(null),
          }).required().when('mode', {
            is: OnuModeEnum.Bridge,
            then: joi.allow(null),
          }),
        },
      },
    },
    handler(request, reply) {
      const { id: oltId } = request.params;
      const { payload } = request;

      reply(
        service.createOnuProfile(oltId, payload)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/olts/{id}/onu/profiles/{profileId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.oltId,
          profileId: joi.string().required(),
        },
        payload: {
          name: joi.string().min(1).max(80).required(),
          mode: joi.string().valid(...values(OnuModeEnum)).required(),
          adminPassword: joi.string().min(1).max(12).required(),

          bridge: joi.object({
            nativeVlan: joi.number().required().allow(null),
            includeVlans: joi.array().items(joi.number().min(2).max(4063)).required().allow(null),
          }).required().when('mode', {
            is: OnuModeEnum.Router,
            then: joi.allow(null),
          }),

          router: joi.object({
            ingressRate: joi.number().required().allow(null),
            egressRate: joi.number().required().allow(null),
            wanVlan: joi.number().min(2).max(4063).required().allow(null),
            gateway: joi.string().ip().required(),
            dnsResolver: joi.string().ip().required().allow(null),
            dhcpPool: joi.string().required().allow(null),
            unmsConnString: joi.string().required().allow(null),
          }).required().when('mode', {
            is: OnuModeEnum.Bridge,
            then: joi.allow(null),
          }),
        },
      },
    },
    handler(request, reply) {
      const { id: oltId, profileId } = request.params;
      const { payload } = request;

      reply(
        service.updateOnuProfile(oltId, profileId, payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/olts/{id}/onu/profiles/{profileId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.oltId,
          profileId: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: oltId, profileId } = request.params;

      reply(
        service.deleteOnuProfile(oltId, profileId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/olts/{id}/onu/policies',
    config: {
      validate: {
        params: {
          id: validation.oltId,
        },
      },
    },
    handler(request, reply) {
      const { id: oltId } = request.params;

      reply(
        service.getOnuPolicies(oltId)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/olts/{id}/onu/policies',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.oltId,
        },
        payload: {
          defaultState: joi.string().valid(...values(DeviceStateEnum)).required(),
        },
      },
    },
    handler(request, reply) {
      const { id: oltId } = request.params;
      const { payload } = request;

      reply(
        service.setOnuPolicies(oltId, payload)
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
