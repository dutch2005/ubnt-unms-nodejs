'use strict';

const boom = require('boom');
const joi = require('joi');

const { find, pick } = require('lodash/fp');
const { pathEq, values } = require('ramda');

const { registerPlugin } = require('../../util/hapi');
const { findDeviceById, isNotUndefined } = require('../../util');
const validation = require('../../validation');
const { OnuModeEnum } = require('../../enums');

/*
 * Route definitions
 */

function register(server) {
  const { devices } = server.plugins.fixtures.devices;

  server.route({
    method: 'GET',
    path: '/v2.0/devices/olts/{id}',
    handler(request, reply) {
      const device = find(pathEq(['identification', 'id'], request.params.id), devices);

      if (isNotUndefined(device)) {
        reply(pick(['identification', 'overview', 'firmware', 'gateway', 'ipAddress', 'meta'], device));
      } else {
        reply(boom.notFound('Device not found'));
      }
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/olts/{id}/locate',
    handler(request, reply) {
      try {
        const olt = findDeviceById(request.params.id, devices);
        if (olt) {
          olt.overview.locating = true;
          reply({ result: true, message: 'Locating olt' });
        } else {
          reply(boom.badData());
        }
      } catch (e) {
        console.error(`Locate olt: ${e}`);
        reply(boom.badImplementation());
      }
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/olts/{id}/unlocate',
    handler(request, reply) {
      try {
        const olt = findDeviceById(request.params.id, devices);
        if (olt) {
          olt.overview.locating = false;
          reply({ result: true, message: 'Unlocating olt' });
        } else {
          reply(boom.badData());
        }
      } catch (e) {
        console.error(`Unlocate olt: ${e}`);
        reply(boom.badImplementation());
      }
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/olts/{id}/reset',
    handler(request, reply) {
      try {
        const olt = findDeviceById(request.params.id, devices);
        if (olt) {
          reply({ result: true, message: 'Olt reset' });
        } else {
          reply(boom.badData());
        }
      } catch (e) {
        console.error(`Reset statistics for olt: ${e}`);
        reply(boom.badImplementation());
      }
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/olts/{id}/onu/profiles',
    config: {
      validate: {
        params: {
          id: validation.oltId,
        },
      },
    },
    handler(request, reply) {
      // TODO(michael.kuk@ubnt.com): Implement
      reply(
        []
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/olts/{id}/onu/profiles',
    config: {
      validate: {
        params: {
          id: validation.oltId,
        },
        payload: {
          id: joi.string().required(), // TODO<michael.kuk@ubnt.com> might need strict regex
          name: joi.string().required(),
          mode: joi.string().valid(...values(OnuModeEnum)).required(),
          adminPassword: joi.string().required(),

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
      const { payload } = request;
      // TODO(michael.kuk@ubnt.com): Implement

      reply(
        payload
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/olts/{id}/onu/profiles/{profile}',
    config: {
      validate: {
        params: {
          id: validation.oltId,
          profile: joi.string().required(),
        },
        payload: {
          id: joi.string().required(), // TODO<michael.kuk@ubnt.com> might need strict regex
          name: joi.string().required(),
          mode: joi.string().valid(...values(OnuModeEnum)).required(),
          adminPassword: joi.string().required(),

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
      const { payload } = request;
      // TODO(michael.kuk@ubnt.com): Implement

      reply(
        payload
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/olts/{id}/onu/profiles/{profile}',
    config: {
      validate: {
        params: {
          id: validation.oltId,
          profile: joi.string().required(),
        },
      },
    },
    handler(request, reply) {
      // TODO(michael.kuk@ubnt.com): Implement

      reply(
        null
      );
    },
  });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'olts_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
