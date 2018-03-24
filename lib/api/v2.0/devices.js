'use strict';

const joi = require('joi');
const { pathEq } = require('ramda');
const { map, pick, find } = require('lodash/fp');
const { constant } = require('lodash');

const { registerPlugin } = require('../../util/hapi');
const validation = require('../../validation');

/*
 * Route definitions
 */
function register(server) {
  const { sites } = server.plugins.fixtures.sites;
  const {
    filterDevicesBySiteId, filterDevicesByParentId, refreshDevices, /* removeDeviceById, */authorizeDevice,
    getDeviceSystem, getDeviceServices, updateDeviceSystem, updateDeviceServices, getBackupData, getBackupsList,
    createNewBackup, uploadBackup, /* removeBackupById, */getMacAddresses, getStatistics, upgradeDeviceFirmwareToLatest,
    getDeviceUnmsSettings, updateDeviceUnmsSettings, findDeviceByMac,
  } = server.plugins.fixtures.devices;


  server.route({
    method: 'GET',
    path: '/v2.0/devices',
    config: {
      validate: {
        query: {
          siteId: validation.siteId.optional(),
          parentId: validation.deviceId.optional(),
        },
      },
    },
    handler(request, reply) {
      reply(
        Promise.resolve(refreshDevices(sites))
          .then(filterDevicesBySiteId(request.query.siteId))
          .then(filterDevicesByParentId(request.query.parentId))
          .then(map(pick[['identification', 'overview', 'firmware']]))
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        Promise.resolve(refreshDevices(sites))
          .then(find(pathEq(['identification', 'id'], request.params.id)))
          .then(pick[['identification', 'overview', 'firmware', 'upgrade', 'meta', 'attributes', 'ipAddress']])
      );
    },
  });


  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      // removeDeviceById(request.params.id);
      reply({ result: true, message: 'Device deleted' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{id}/refresh',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      setTimeout(() => {
        reply({ result: true, message: 'Device refreshed' });
      }, 1000);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{id}/restart',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      setTimeout(() => {
        reply({ result: true, message: 'Device restarted' });
      }, 5000);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{id}/upgrade-to-latest',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      upgradeDeviceFirmwareToLatest(request.params.id);
      reply({ result: true, message: 'Device upgrade started' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{id}/authorize',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          siteId: validation.siteId,
        },
      },
    },
    handler(request, reply) {
      authorizeDevice(sites, request.payload.siteId, request.params.id);
      reply({ result: true, message: 'Device authorized' });
    },
  });

  // create and download a new multi device backup.
  server.route({
    method: 'POST',
    path: '/v2.0/devices/backups',
    config: {
      validate: {
        payload: {
          deviceIds: joi.array().items(validation.deviceId).min(1),
        },
      },
    },
    handler(request, reply) {
      reply(getBackupData(request.payload.deviceIds)).type('application/tar+gzip');
    },
  });

  // get list of backups
  server.route({
    method: 'GET',
    path: '/v2.0/devices/{id}/backups',
    config: {
      validate: {
        params: {
          id: joi.string().required(), // in v2.1 this should be validated as guid.
        },
      },
    },
    handler(request, reply) {
      reply(getBackupsList());
    },
  });

  // create new backup on the device
  server.route({
    method: 'POST',
    path: '/v2.0/devices/{id}/backups',
    config: {
      validate: {
        params: {
          id: joi.string().required(), // in v2.1 this should be validated as guid.
        },
      },
    },
    handler(request, reply) {
      setTimeout(() => {
        reply(createNewBackup());
      }, 5000);
    },
  });

  // upload new backup file
  server.route({
    method: 'PUT',
    path: '/v2.0/devices/{id}/backups',
    config: {
      validate: {
        params: {
          id: joi.string().required(), // in v2.1 this should be validated as guid.
        },
      },
    },
    handler(request, reply) {
      const file = request.payload.file;
      const files = Array.isArray(file) ? file : [file];

      setTimeout(() => {
        reply(files.map(uploadBackup));
      }, 5000);
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{deviceId}/backups/{backupId}',
    config: {
      validate: {
        params: {
          deviceId: joi.string().required(), // in v2.1 this should be validated as guid.
          backupId: joi.string().required(), // in v2.1 this should be validated as guid.
        },
      },
    },
    handler(request, reply) {
      reply(getBackupData(request.params.deviceId)).type('application/tar+gzip');
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/{deviceId}/backups/{backupId}',
    config: {
      validate: {
        params: {
          deviceId: joi.string().required(), // in v2.1 this should be validated as guid.
          backupId: joi.string().required(), // in v2.1 this should be validated as guid.
        },
      },
    },
    handler(request, reply) {
      reply(
        Promise
          .resolve(/* removeBackupById(request.params.backupId) */)
          .then(constant({ result: true, message: 'Backup deleted' }))
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{deviceId}/backups/{backupId}/apply',
    config: {
      validate: {
        params: {
          deviceId: joi.string().required(), // in v2.1 this should be validated as guid.
          backupId: joi.string().required(), // in v2.1 this should be validated as guid.
        },
      },
    },
    handler(request, reply) {
      setTimeout(() => {
        reply({ result: true, message: 'Backup applied' });
      }, 5000);
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{id}/statistics',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        query: {
          interval: validation.interval,
        },
      },
    },
    handler(request, reply) {
      reply(getStatistics(request.params.id, request.query.interval));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{id}/system',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(getDeviceSystem(request.params.id));
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/{id}/system',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(updateDeviceSystem(request.params.id, request.payload));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{id}/system/unms',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(getDeviceUnmsSettings(request.params.id));
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/{id}/system/unms',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(updateDeviceUnmsSettings(request.params.id, request.payload));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{id}/services',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(getDeviceServices(request.params.id));
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/{id}/services',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(updateDeviceServices(request.params.id, request.payload));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/macs',
    handler(request, reply) {
      reply(getMacAddresses());
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/macs/{mac}',
    config: {
      validate: {
        params: {
          mac: validation.macAddress,
        },
      },
    },
    handler(request, reply) {
      reply(findDeviceByMac(request.params.mac));
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'devices_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
