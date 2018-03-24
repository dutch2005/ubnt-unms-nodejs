'use strict';

/*
 * Hapijs routes definition
 */

const validation = require('../../../validation');
const joi = require('joi');
const Boom = require('boom');
const { values } = require('ramda');

const { OspfAuthTypeEnum } = require('../../../enums');

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/devices/{deviceId}/interfaces',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { deviceId } = request.params;

      reply(
        service.getInterfaceList(deviceId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/interfaces',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(Boom.notImplemented('Creating new interface is not yet implemented'));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;

      reply(
        service.getInterfaceConfig(deviceId, interfaceName)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;
      const { payload } = request;

      reply(
        service.updateInterfaceConfig(deviceId, interfaceName, payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;

      reply(
        service.removeInterface(deviceId, interfaceName)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}/ospf',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
        payload: {
          cost: joi.number().integer().min(1).max(255).required().allow(null),
          auth: joi.string().valid(...values(OspfAuthTypeEnum)).required(),
          authKey: joi.string().required().when('auth', {
            is: OspfAuthTypeEnum.None,
            then: joi.allow(null),
          }),
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;
      const { payload } = request;

      reply(
        service.setOspfConfig(deviceId, interfaceName, payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}/ospf',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;

      reply(
        service.unsetOspfConfig(deviceId, interfaceName)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}/block',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;
      const { userId } = request.token;

      reply(
        service.blockInterface(deviceId, interfaceName, userId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}/unblock',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;
      const { userId } = request.token;

      reply(
        service.unblockInterface(deviceId, interfaceName, userId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/interfaces/vlan',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
        payload: {
          description: joi.string().optional().allow(null),
          interface: validation.interfaceName,
          mtu: validation.interfaceMtu,
          vlanId: joi.number().integer().required(),
          addresses: validation.interfaceAddresses,
        },
      },
    },
    handler(request, reply) {
      const { deviceId } = request.params;
      const { payload } = request;

      reply(
        service.createVlan(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/interfaces/pppoe',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
        payload: {
          account: joi.string().optional().allow(null),
          interface: validation.interfaceName,
          mtu: validation.interfaceMtu,
          pppoeId: joi.number().integer().required(),
          password: joi.string().min(4).max(20).required(),
        },
      },
    },
    handler(request, reply) {
      const { deviceId } = request.params;
      const { payload } = request;

      reply(
        service.createPPPoE(deviceId, payload)
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
