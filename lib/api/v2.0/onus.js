'use strict';


const { Chance } = require('chance');
const { assocPath, assoc, pathEq } = require('ramda');
const { isNotUndefined } = require('ramda-adjunct');
// const { pull } = require('lodash');
const moment = require('moment-timezone');
const {
  curry, isUndefined, sampleSize, sample, random, filter, map, head, pick, clamp, flow, defaultTo,
} = require('lodash/fp');

const { registerPlugin } = require('../../util/hapi');
const { DeviceTypeEnum, StatusEnum } = require('../../enums');
const validation = require('../../validation');

/*
 * Fixtures
 */

const parentIdOnuMap = new Map();

/*
 * Business logic
 */

const chance = new Chance();
const uptime = moment();

const isOnu = pathEq(['identification', 'type'], DeviceTypeEnum.Onu);

const isOlt = pathEq(['identification', 'type'], DeviceTypeEnum.Olt);

const decorateWithOlt = curry((oltId, device) => {
  if (isNotUndefined(oltId) && isUndefined(device.onu)) {
    // eslint-disable-next-line no-param-reassign
    device.onu = { id: oltId, port: sample([1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]) };
  }
  return device;
});


const filterByParentId = curry((deviceId, devicesToFilter) => {
  if (isUndefined(deviceId)) { return devicesToFilter }
  if (parentIdOnuMap.has(deviceId)) { return parentIdOnuMap.get(deviceId) }

  const filteredDevices = sampleSize(random(100, 1000), devicesToFilter);
  filteredDevices.forEach(decorateWithOlt(deviceId));
  parentIdOnuMap.set(deviceId, filteredDevices);
  return filteredDevices;
});

const updateStatsValue = (opts, lastValue) => {
  const { min, max } = opts;
  const diffRange = Math.abs(max - min) / 10; // max diff is 10th of the range
  const nextValue = !lastValue
    ? chance.floating(opts)
    : lastValue + chance.floating(Object.assign(opts, { min: -diffRange, max: diffRange }));
  return clamp(min, max, nextValue);
};

const updateUptime = device => assocPath(
  ['overview', 'uptime'],
  moment().diff(uptime, 'seconds') + device.overview.uptime,
  device
);

const updateCPU = device => assocPath(
  ['overview', 'cpu'],
  updateStatsValue({ min: 2, max: 20, fixed: 0 }, device.overview.cpu),
  device
);

const updateRAM = device => assocPath(
  ['overview', 'ram'],
  updateStatsValue({ min: 5, max: 15, fixed: 0 }, device.overview.ram),
  device
);

const updateSignal = device => assocPath(
  ['overview', 'signal'],
  updateStatsValue({ min: -90, max: -20 }, device.overview.signal),
  device
);

const updateDistance = device => assocPath(
  ['overview', 'distance'],
  15323,
  device
);

const decorateWithParentId = curry((oltId, device) => assocPath(['parentId'], defaultTo(null, oltId), device));

const onuConfiguration = ['identification', 'overview', 'firmware', 'parentId', 'onu'];

/*
 * Route definitions
 */

function register(server) {
  const { devices } = server.plugins.fixtures.devices;
  const olt = flow(filter(isOlt), head)(devices);

  server.route({
    method: 'GET',
    path: '/v2.0/devices/onus',
    config: {
      auth: false,
      validate: {
        query: {
          parentId: validation.deviceId.optional(),
        },
      },
    },
    handler(request, reply) {
      const parentId = request.query.parentId;

      reply(
        Promise
          .resolve(devices)
          .then(filter(isOnu))
          .then(filterByParentId(parentId))
          .then(map(updateUptime))
          .then(map(updateCPU))
          .then(map(updateRAM))
          .then(map(updateSignal))
          .then(map(updateDistance))
          .then(map(decorateWithOlt(parentId)))
          .then(map(decorateWithParentId(parentId)))
          .then(map(pick(onuConfiguration)))
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/onus/{id}',
    handler(request, reply) {
      const onu = devices.find(pathEq(['identification', 'id'], request.params.id));

      reply(
        Promise
          .resolve(onu)
          .then(decorateWithOlt(olt.identification.id))
          .then(decorateWithParentId(olt.identification.id))
          .then(pick(onuConfiguration))
          .then(assoc('canDisplayStatistics', true))
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/onus/{id}/block',
    handler(request, reply) {
      const onu = devices.find(pathEq(['identification', 'id'], request.params.id));

      onu.overview.status = StatusEnum.Disabled;
      reply({ result: true, message: 'Onu blocked' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/onus/{id}/unblock',
    handler(request, reply) {
      const onu = devices.find(pathEq(['identification', 'id'], request.params.id));

      onu.overview.status = StatusEnum.Active;
      reply({ result: true, message: 'Onu unblocked' });
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/onus/{id}',
    handler(request, reply) {
      // const onu = devices.find(pathEq(['identification', 'id'], request.params.id));

      // pull(devices, onu);
      // parentIdOnuMap.clear();
      reply({ result: true, message: 'Onu deleted' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/onus/{id}/reset',
    handler(request, reply) {
      setTimeout(() => {
        reply({ result: true, message: 'Onu reset' });
      }, 2000);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/onus/{id}/upgrade',
    handler(request, reply) {
      setTimeout(() => {
        reply({ result: true, message: 'Onu upgraded' });
      }, 2000);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/onus/{id}/resetstats',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const onu = devices.find(pathEq(['identification', 'id'], request.params.id));

      onu.overview.txBytes = 0;
      onu.overview.rxBytes = 0;
      reply({ result: true, message: 'Interface statistics reset' });
    },
  });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'onus_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};

