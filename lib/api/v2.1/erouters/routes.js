'use strict';

/*
 * Hapijs routes definition
 */
const { values } = require('ramda');

const validation = require('../../../validation');
const joi = require('joi');
const { StaticRouteTypeEnum, OspfAreaTypeEnum, OspfAuthTypeEnum } = require('../../../enums');

const schemas = require('./schemas');


function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        service.erouterDetail(request.params.id)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}/router/routes',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        service.routeList(request.params.id)
      );
    },
  });

  server.route({
    method: ['POST', 'PUT'],
    path: '/v2.1/devices/erouters/{id}/router/routes',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          interface: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          gateway: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).required(),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;
      const { payload } = request;

      reply(
        service.routeCreate(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/router/routes/delete',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          interface: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          gateway: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).allow(null),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;
      const { payload } = request;

      reply(
        service.routeDelete(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/router/routes/block',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          interface: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          gateway: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).allow(null),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;
      const { payload } = request;

      reply(
        service.routeBlock(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/router/routes/unblock',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          interface: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          gateway: joi.string().required()
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).allow(null),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;
      const { payload } = request;

      reply(
        service.routeUnblock(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}/router/ospf',
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
        service.getOspfConfig(deviceId)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/erouters/{id}/router/ospf',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          router: joi.string().ip().required().allow(null),
          redistributeDefaultRoute: joi.object({
            enabled: joi.bool().required(),
          }).required(),
          redistributeStatic: joi.object({
            enabled: joi.bool().required(),
            metric: joi.number().min(1).max(16).required().allow(null),
          }).required(),
          redistributeConnected: joi.object({
            enabled: joi.bool().required(),
            metric: joi.number().min(1).max(16).required().allow(null),
          }).required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;
      const { payload } = request;

      reply(
        service.setOspfConfig(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}/router/ospf/areas',
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
        service.ospfAreasList(deviceId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/router/ospf/areas',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          id: joi.string().ip().required(),
          auth: joi.string().valid(...values(OspfAuthTypeEnum)),
          type: joi.string().valid(...values(OspfAreaTypeEnum)).required(),
          networks: joi.array().min(1).items(validation.routes.destination).required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId } = request.params;
      const { payload } = request;

      reply(
        service.createOspfArea(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/erouters/{id}/router/ospf/areas/{areaId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          areaId: joi.string().ip().required(),
        },
        payload: {
          id: joi.string().ip(),
          auth: joi.string().valid(...values(OspfAuthTypeEnum)),
          type: joi.string().valid(...values(OspfAreaTypeEnum)).required(),
          networks: joi.array().min(1).items(validation.routes.destination).required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, areaId } = request.params;
      const { payload } = request;

      reply(
        service.updateOspfArea(deviceId, areaId, payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/erouters/{id}/router/ospf/areas/{areaId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          areaId: joi.string().ip().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, areaId } = request.params;

      reply(
        service.deleteOspfArea(deviceId, areaId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const deviceId = request.params.id;

      reply(
        service.getDHCPServersList(deviceId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers/{serverName}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, serverName } = request.params;

      reply(
        service.getDHCPServer(deviceId, serverName)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: schemas.createDHCPServerValidation,
      },
    },
    handler(request, reply) {
      const { params: { id: deviceId }, payload } = request;

      reply(
        service.createDHCPServer(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers/{serverName}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
        payload: schemas.updateDHCPServerValidation,
      },
    },
    handler(request, reply) {
      const { params: { id: deviceId, serverName }, payload } = request;

      reply(
        service.updateDHCPServer(deviceId, serverName, payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers/{serverName}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, serverName } = request.params;

      reply(
        service.deleteDHCPServer(deviceId, serverName)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers/{serverName}/block',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, serverName } = request.params;

      reply(
        service.blockDHCPServer(deviceId, serverName)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/dhcp/servers/{serverName}/unblock',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, serverName } = request.params;

      reply(
        service.unblockDHCPServer(deviceId, serverName)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/erouters/{id}/dhcp/leases',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const deviceId = request.params.id;

      reply(
        service.getDHCPLeases(deviceId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/erouters/{id}/dhcp/leases',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: schemas.DHCPLeaseValidation,
      },
    },
    handler(request, reply) {
      const { params: { id: deviceId }, payload } = request;

      reply(
        service.createDHCPLease(deviceId, payload)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/erouters/{id}/dhcp/leases/{serverName}/{leaseId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
          leaseId: joi.string().required(),
        },
        payload: schemas.DHCPLeaseValidation,
      },
    },
    handler(request, reply) {
      const { params: { id: deviceId, serverName, leaseId }, payload } = request;

      reply(
        service.updateDHCPLease(deviceId, serverName, leaseId, payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/erouters/{id}/dhcp/leases/{serverName}/{leaseId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
          leaseId: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const { id: deviceId, serverName, leaseId } = request.params;

      reply(
        service.deleteDHCPLease(deviceId, serverName, leaseId)
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
