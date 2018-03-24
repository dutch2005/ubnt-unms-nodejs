'use strict';

const joi = require('joi');
const Chance = require('chance');
const randomMac = require('random-mac');
const validation = require('../../validation');
const { remove, unset } = require('lodash');
const { pathEq, propEq, assoc } = require('ramda');
const Boom = require('boom');
const { NO_CONTENT } = require('http-status');
const {
  constant, find, isUndefined, overEvery, sample, uniqueId,
  random, values, range, flow, map, pick,
} = require('lodash/fp');

const { registerPlugin } = require('../../util/hapi');
const { isNotUndefined } = require('../../util');
const {
  DhcpLeaseTypeEnum, RouteTypeEnum, RouteGatewayStatusEnum, StaticRouteTypeEnum, OspfAreaTypeEnum, OspfAuthTypeEnum,
} = require('../../enums');

/*
 * Fixtures
 */
const chance = new Chance();

/*
 * IP Leases
 */

const generateStaticLease = subnet => ({
  leaseId: uniqueId('lease'),
  type: DhcpLeaseTypeEnum.Static,
  address: `192.168.${subnet}.${random(1, 50)}`,
  mac: randomMac(),
  serverName: 'dhcp101',
  expiration: null,
  hostname: null,
});

const generateDynamicLease = () => ({
  leaseId: null,
  type: DhcpLeaseTypeEnum.Dynamic,
  address: '192.168.102.50',
  mac: randomMac(),
  serverName: 'dhcp102',
  expiration: '2017-12-07T09:29:20+01:00',
  hostname: 'MB',
});

const generateLeases = () => [
  generateStaticLease(101),
  generateStaticLease(101),
  generateDynamicLease(101),
];


/*
 * DHCP Servers
 */

const generateDHCPServer = subnet => ({
  enabled: true,
  name: `dhcp${subnet}`,
  interface: `192.168.${subnet}.0/24`,
  rangeStart: `192.168.${subnet}.1`,
  rangeEnd: `192.168.${subnet}.50`,
  poolSize: 50,
  available: 30,
  leases: 2,
});

const generateDHCPServers = () => [
  generateDHCPServer(100),
  generateDHCPServer(101),
  generateDHCPServer(102),
  generateDHCPServer(103),
];

const generateDHCPServerConfiguration = (dhcpServer) => {
  const subnet = sample([1, 2]);
  return Object.assign({}, {
    name: '',
    interface: `192.168.${subnet}.0/24`,
    rangeStart: `192.168.${subnet}.1`,
    rangeEnd: `192.168.${subnet}.50`,
    router: '192.168.1.1',
    dns1: '8.8.8.8',
    dns2: '8.8.8.9',
    leaseTime: 86400,
  }, dhcpServer);
};

/*
 * Routes
 */

const generateRouteOverview = () => ({
  type: sample(values(RouteTypeEnum)),
  enabled: sample([true, false]),
  destination: `1.1.1.${random(1, 100)}/24`,
  nextHop: `2.2.2.${random(1, 100)}`,
  gateway: `192.168.1.${random(1, 100)}`,
  gatewayStatus: sample(values(RouteGatewayStatusEnum)),
  interface: `eth${random(1, 10)}`,
  distance: random(1, 250),
  fib: sample([true, false]),
  selected: sample([true, false]),
  description: 'Simple route description',
});

const generateRouteOverviewType1 = () => Object.assign({}, generateRouteOverview(), {
  destination: '0.0.0.0/0',
  nextHop: '192.168.99.1',
  interface: 'eth0',
  type: RouteTypeEnum.Static,
  fib: true,
});

const generateRouteOverviewType2 = () => Object.assign({}, generateRouteOverview(), {
  destination: '127.0.0.0/8',
  nextHop: null,
  interface: 'lo',
  type: RouteTypeEnum.Connected,
  fib: true,
});

const generateRouteOverviewType3 = ethNumber => Object.assign({}, generateRouteOverview(), {
  destination: `192.168.88.${random(1, 255)}/24`,
  nextHop: null,
  interface: `eth${ethNumber}`,
  fib: true,
});

const generateRouteOverviewType4 = () => Object.assign({}, generateRouteOverview(), {
  destination: '192.168.123.0/24',
  nextHop: '192.168.123.1',
  interface: 'eth0',
  type: RouteTypeEnum.Static,
  fib: false,
});

const generateStaticRoute = () => ({
  type: sample(values(StaticRouteTypeEnum)),
  destination: `1.1.1.${random(1, 100)}/24`,
  gateway: null,
  interface: `eth${random(1, 10)}`,
  distance: random(1, 250),
  description: 'Simple static route description',
});

const generateRouteOverviews = () => [
  generateRouteOverviewType1(),
  generateRouteOverviewType2(),
  generateRouteOverviewType4(),
].concat(range(1, 100).map(generateRouteOverviewType3));

/*
 * OSPF
 */

const generateOspfConfig = () => ({
  router: chance.ip(),
  redistributeConnected: {
    enabled: true,
    metric: 10,
  },
  redistributeStatic: {
    enabled: false,
    metric: null,
  },
  redistributeDefaultRoute: {
    enabled: false,
  },
});

const generateOspfArea = index => ({
  id: index === 0 ? '0.0.0.0' : chance.ip(),

  type: index === 0
    ? OspfAreaTypeEnum.Default
    : OspfAreaTypeEnum[Object.keys(OspfAreaTypeEnum)[chance.integer({ min: 0, max: 2 })]],

  auth: OspfAuthTypeEnum[Object.keys(OspfAuthTypeEnum)[chance.integer({ min: 0, max: 2 })]],
  networks: range(0, chance.integer({ min: 1, max: 5 }))
    .map(() => `${chance.ip()}/${chance.integer({ min: 8, max: 30 })}`),
});

const generateOspfAreas = flow(
  () => range(0, chance.integer({ min: 1, max: 10 })),
  map(generateOspfArea)
);

/*
 * Business logic
 */

const deviceSelector = pathEq(['identification', 'id']);

const getLeases = (deviceId, devices) => {
  const erouter = devices.find(deviceSelector(deviceId));
  if (isUndefined(erouter.leases)) {
    erouter.leases = generateLeases();
  }
  return erouter.leases;
};

const getServers = (deviceId, devices) => {
  const erouter = devices.find(deviceSelector(deviceId));
  if (isUndefined(erouter.servers)) {
    erouter.servers = generateDHCPServers();
  }
  return erouter.servers;
};

const getRoutes = (deviceId, devices) => {
  const erouter = devices.find(deviceSelector(deviceId));
  if (isUndefined(erouter.routes)) {
    erouter.routes = generateRouteOverviews();
  }
  return erouter.routes;
};

const getOspfConfig = (deviceId, devices) => {
  const erouter = devices.find(deviceSelector(deviceId));
  if (isUndefined(erouter.ospfConfig)) {
    erouter.ospfConfig = generateOspfConfig();
  }
  return erouter.ospfConfig;
};

const updateOspfConfig = (deviceId, devices, config) => {
  const erouter = devices.find(deviceSelector(deviceId));
  erouter.ospfConfig = config;
  return erouter.ospfConfig;
};

const getOspfAreas = (deviceId, devices) => {
  const erouter = devices.find(deviceSelector(deviceId));
  if (isUndefined(erouter.ospfAreas)) {
    erouter.ospfAreas = generateOspfAreas();
  }
  return erouter.ospfAreas;
};

const createOspfArea = (deviceId, devices, payload) => {
  const erouter = devices.find(deviceSelector(deviceId));
  const area = erouter.ospfAreas.find(pathEq(['id'], payload.id));

  if (area) {
    return Boom.conflict();
  }

  erouter.ospfAreas.push(payload);
  return payload;
};

const editOspfArea = (deviceId, devices, areaId, payload) => {
  const erouter = devices.find(deviceSelector(deviceId));
  const area = erouter.ospfAreas.find(pathEq(['id'], payload.id));

  if (!area) {
    return Boom.notFound();
  }

  unset(payload, 'id');

  area.networks = payload.networks;
  area.type = payload.type;
  return area;
};

// const deleteOspfArea = (deviceId, devices, areaId) => {
//   const erouter = devices.find(deviceSelector(deviceId));
//   const area = erouter.ospfAreas.find(pathEq(['id'], areaId));

//   if (!area) {
//     return Boom.notFound();
//   }

//   return erouter.ospfAreas.splice(erouter.ospfAreas.indexOf(area), 1);
// };

const mapStaticRouteToRouteOverview = staticRoute =>
  flow(
    generateRouteOverview,
    assoc('type', sample(values(RouteTypeEnum))),
    assoc('destination', staticRoute.destination),
    assoc('interface', staticRoute.interface),
    assoc('distance', staticRoute.distance),
    assoc('description', staticRoute.description)
  )();

/*
 * Route definitions
 */

function register(server) {
  const { devices } = server.plugins.fixtures.devices;

  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const device = find(pathEq(['identification', 'id'], request.params.id), devices);

      if (isNotUndefined(device)) {
        reply(pick(['identification', 'overview', 'firmware', 'gateway', 'ipAddress', 'meta'], device));
      } else {
        reply(Boom.notFound('Device not found'));
      }
    },
  });

  /*

   DHCP servers

   */

  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(getServers(request.params.id, devices));
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      setTimeout(() => {
        getServers(request.params.id, devices).push(generateDHCPServer(1));
        reply(request.payload);
      }, 5000);
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers/{serverName}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const dhcpServers = getServers(request.params.id, devices);
      const dhcpServer = find(propEq('name', request.params.serverName), dhcpServers);

      reply(generateDHCPServerConfiguration(dhcpServer));
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers/{serverName}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      // const selector = propEq('name', request.params.serverName);

      reply(
        Promise
          .resolve() // remove(getServers(request.params.id, devices), selector)
          .then(constant({ result: true, message: 'DHCP server deleted' }))
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers/{serverName}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      setTimeout(() => {
        reply(request.payload);
      }, 5000);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers/{serverName}/block',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const dhcpServers = getServers(request.params.id, devices);
      const dhcpServer = find(['name', request.params.serverName], dhcpServers);

      dhcpServer.enabled = false;

      reply({ result: true, message: 'DHCP server blocked' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/dhcp/servers/{serverName}/unblock',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const dhcpServers = getServers(request.params.id, devices);
      const dhcpServer = find(['name', request.params.serverName], dhcpServers);

      dhcpServer.enabled = true;

      reply({ result: true, message: 'DHCP server unblocked' });
    },
  });


  /*

  Leases

   */


  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}/dhcp/leases',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(getLeases(request.params.id, devices));
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/dhcp/leases',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const leases = getLeases(request.params.id, devices);
      const newLease = Object.assign({}, generateStaticLease(), request.payload);

      leases.push(newLease);
      setTimeout(() => {
        reply(newLease);
      }, 500);
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/erouters/{id}/dhcp/leases/{serverName}/{leaseId}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
          leaseId: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      const leases = getLeases(request.params.id, devices);
      const leaseSelector = overEvery([
        propEq('serverName', request.params.serverName),
        propEq('leaseId', request.params.leaseId),
      ]);
      const lease = leases.find(leaseSelector);

      Object.assign(lease, request.payload);

      reply(lease);
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/erouters/{id}/dhcp/leases/{serverName}/{leaseId}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          serverName: joi.string().required(),
          leaseId: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      // const leaseSelector = overEvery([
      //   propEq('serverName', request.params.serverName),
      //   propEq('leaseId', request.params.leaseId),
      // ]);

      reply(
        Promise
          .resolve() // remove(getLeases(request.params.id, devices), leaseSelector)
          .then(constant({ result: true, message: 'Lease deleted.' }))
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}/router/routes',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(getRoutes(request.params.id, devices));
    },
  });

  server.route({
    method: ['POST', 'PUT'],
    path: '/v2.0/devices/erouters/{id}/router/routes',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          gateway: validation.routes.gateway
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          interface: validation.routes.interface
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).required(),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const selector = overEvery([
        pathEq(['destination'], request.payload.destination),
        pathEq(['gateway'], request.payload.gateway),
        pathEq(['interface'], request.payload.interface),
      ]);

      const routes = getRoutes(request.params.id, devices);

      remove(routes, selector);

      const newStaticRoute = generateStaticRoute();
      const newRoute = mapStaticRouteToRouteOverview(newStaticRoute);

      routes.unshift(newRoute);
      reply(newRoute);
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/router/routes/unblock',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          gateway: validation.routes.gateway
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          interface: validation.routes.interface
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).required(),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const selector = overEvery([
        pathEq(['destination'], request.payload.destination),
        pathEq(['gateway'], request.payload.gateway),
        pathEq(['interface'], request.payload.interface),
      ]);

      const route = find(selector, getRoutes(request.params.id, devices));

      route.enabled = true;
      reply({ result: true, message: 'Route unblocked' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/router/routes/block',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          gateway: validation.routes.gateway
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          interface: validation.routes.interface
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255).required(),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      const selector = overEvery([
        pathEq(['destination'], request.payload.destination),
        pathEq(['gateway'], request.payload.gateway),
        pathEq(['interface'], request.payload.interface),
      ]);

      const route = find(selector, getRoutes(request.params.id, devices));

      route.enabled = false;
      reply({ result: true, message: 'Route blocked' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/router/routes/delete',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          staticType: joi.string().valid(...values(StaticRouteTypeEnum)).required(),
          destination: validation.routes.destination,
          gateway: validation.routes.gateway
            .when('staticType', {
              is: StaticRouteTypeEnum.Gateway,
              otherwise: joi.allow(null),
            }),
          interface: validation.routes.interface
            .when('staticType', {
              is: StaticRouteTypeEnum.Interface,
              otherwise: joi.allow(null),
            }),
          distance: joi.number().min(1).max(255),
          description: joi.string().max(200).allow(null),
        },
      },
    },
    handler(request, reply) {
      // const selector = overEvery([
      //   pathEq(['destination'], request.payload.destination),
      //   pathEq(['gateway'], request.payload.gateway),
      //   pathEq(['interface'], request.payload.interface),
      // ]);

      reply(
        Promise
          .resolve(/* remove(getRoutes(request.params.id, devices), selector) */)
          .then(constant({ result: true, message: 'Route deleted.' }))
      );
    },
  });

  // OSPF
  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}/router/ospf',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        getOspfConfig(request.params.id, devices)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/erouters/{id}/router/ospf',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          router: joi.string().required(),
          redistributeConnected: joi.object({
            enabled: joi.bool().required(),
            metric: joi.number().min(0).allow(null),
          }).required(),
          redistributeStatic: joi.object({
            enabled: joi.bool().required(),
            metric: joi.number().min(0).allow(null),
          }).required(),
          redistributeDefaultRoute: joi.object({
            enabled: joi.bool().required(),
          }).required(),
        },
      },
    },
    handler(request, reply) {
      reply(
        updateOspfConfig(request.params.id, devices, request.payload)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/erouters/{id}/router/ospf/areas',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        getOspfAreas(request.params.id, devices)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/erouters/{id}/router/ospf/areas',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          id: joi.string().ip().required(),
          type: joi.string().required(),
          networks: joi.array().items(joi.string().ip()).required(),
        },
      },
    },
    handler(request, reply) {
      reply(
        createOspfArea(request.params.id, devices, request.payload)
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/erouters/{id}/router/ospf/areas/{areaId}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          areaId: joi.string().ip().required(),
        },
        payload: {
          id: joi.string(),
          type: joi.string().required(),
          networks: joi.array().items(joi.string().ip()).required(),
        },
      },
    },
    handler(request, reply) {
      reply(
        editOspfArea(request.params.id, devices, request.params.areaId, request.payload)
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/erouters/{id}/router/ospf/areas/{areaId}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
          areaId: joi.string().ip().required(),
        },
      },
    },
    handler(request, reply) {
      // deleteOspfArea(request.params.id, devices, request.params.areaId);
      reply().code(NO_CONTENT);
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'erouters_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
