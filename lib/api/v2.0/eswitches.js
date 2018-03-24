'use strict';

const Boom = require('boom');
const { pathEq } = require('ramda');
const { isNotUndefined } = require('ramda-adjunct');
const { find, pick } = require('lodash/fp');

const validation = require('../../validation');

const { registerPlugin } = require('../../util/hapi');

/*
 * Route definitions
 */

function register(server) {
  const { devices } = server.plugins.fixtures.devices;

  server.route({
    method: 'GET',
    path: '/v2.0/devices/eswitches/{id}',
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
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'eswitches_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
