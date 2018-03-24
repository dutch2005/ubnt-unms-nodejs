'use strict';

const { pick, mapValues } = require('lodash/fp');
const { constant, isString } = require('lodash');

const { tapP, entityExistsCheck } = require('../../../util');
const { DB } = require('../../../db');
const { extendTokenExpiry } = require('./service.js');
const config = require('../../../../config');
const enums = require('../../../enums');

function registerRoutes(server) {
  server.route({
    path: '/v2.1/nms/setup',
    method: 'GET',
    config: {
      auth: false,
    },
    handler(request, reply) {
      reply(
        DB.nms.get()
          .then(pick('isConfigured'))
          .then(mapValues(Boolean))
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/nms/keep-alive',
    config: {
      auth: isString(config.authStrategy) ? {
        strategy: config.authStrategy,
        mode: 'try',
      } : false,
    },
    handler(request, reply) {
      if (!request.auth.isAuthenticated) { return reply({ result: true, message: 'Keep alive' }) }

      return reply(
        DB.token.findById(request.token.id)
          .then(tapP(entityExistsCheck(enums.EntityEnum.Token)))
          .then(extendTokenExpiry)
          .then(DB.token.update)
          .then(constant({ result: true, message: 'Keep alive' }))
      );
    },
  });

  server.route({
    method: 'GET',
    config: {
      auth: false,
    },
    path: '/v2.1/nms/enums',
    handler(request, reply) {
      reply(enums);
    },
  });

  server.route({
    path: '/v2.1/nms/server-config',
    method: 'GET',
    config: {
      auth: false,
    },
    handler(request, reply) {
      reply({
        isCloudSmtpAvailable: config.cloud,
        canConfigureMaps: !config.cloud,
        latestVersionUrl: config.unmsLatestVersionUrl,
        updateVersionOverride: server.plugins.web.getUpdateVersionOverride(),
        useCustomSslCert: config.useCustomSslCert,
      });
    },
  });
}

module.exports = {
  registerRoutes,
};
