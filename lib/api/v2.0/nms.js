'use strict';

const Joi = require('joi');
const { size, flow } = require('lodash/fp');
const { values, pathEq, filter } = require('ramda');

const { registerPlugin } = require('../../util/hapi');
const config = require('../../../config');
const Validation = require('../../validation');
const enums = require('../../enums');

const settings = {
  hostname: 'https://unms-demo.ubnt.com',
  autoBackups: true,
  mapsProvider: enums.MapsProviderEnum.GoogleMaps,
  googleMapsApiKey: 'AIzaSyDwRmtZVoOXilRj05OOrDcVjyRdJzduHuQ',
  devicePingAddress: 'unms-demo.ubnt.com',
  devicePingIntervalNormal: 30000,
  devicePingIntervalOutage: 5000,
  timeFormat: 'h:mm a',
  timezone: 'Europe/Prague',
  dateFormat: 'D MMM YYYY',
};

const filterUnauthorized = filter(pathEq(['overview', 'status'], enums.StatusEnum.Unauthorized));
const getUnauthorizedDevicesCount = flow(filterUnauthorized, size);


/*
 * Route definitions
 */

function register(server, options) {
  const { sites } = server.plugins.fixtures.sites;
  const { devices, getNMSStatistics } = server.plugins.fixtures.devices;
  const { web: webPlugin } = server.plugins;

  server.route({
    method: 'GET',
    path: '/v2.0/nms/heartbeat',
    handler(request, reply) {
      reply({ result: true, message: "I'm alive" });
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      method: 'GET',
      path: '/v2.1/nms/heartbeat',
      handler(request, reply) {
        reply({ result: true, message: "I'm alive" });
      },
    });
  }

  server.route({
    method: 'GET',
    path: '/v2.0/nms/keep-alive',
    handler(request, reply) {
      return reply({ result: true, message: 'Keep alive' });
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      method: 'GET',
      path: '/v2.1/nms/keep-alive',
      handler(request, reply) {
        return reply({ result: true, message: 'Keep alive' });
      },
    });
  }

  server.route({
    method: 'GET',
    path: '/v2.0/nms/enums',
    handler(request, reply) {
      reply(enums);
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      method: 'GET',
      path: '/v2.1/nms/enums',
      handler(request, reply) {
        reply(enums);
      },
    });
  }

  server.route({
    method: 'GET',
    path: '/v2.0/nms/connection',
    handler(request, reply) {
      reply(' --- not supported in demo version ---');
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      method: 'GET',
      path: '/v2.1/nms/connection',
      handler(request, reply) {
        reply(' --- not supported in demo version ---');
      },
    });
  }

  server.route({
    path: '/v2.0/nms/setup',
    method: 'GET',
    handler(request, reply) {
      reply({ isConfigured: true });
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      path: '/v2.1/nms/setup',
      method: 'GET',
      handler(request, reply) {
        reply({ isConfigured: true });
      },
    });
  }


  server.route({
    path: '/v2.0/nms/setup',
    method: 'POST',
    config: {
      validate: {
        payload: {
          hostname: Validation.hostname,
          user: Joi.object().keys({
            username: Validation.username,
            email: Joi.string().email().required(),
            timezone: Validation.timezone.required(),
            password: Validation.password,
          }).with('username', 'email', 'password', 'timezone'),
          smtp: Validation.smtp,
        },
      },
    },
    handler(request, reply) {
      reply({
        result: true,
        message: 'Setup Complete',
      });
    },
  });

  server.route({
    path: '/v2.0/nms/server-config',
    method: 'GET',
    handler(request, reply) {
      reply({
        isCloudSmtpAvailable: false,
        canConfigureMaps: true,
        latestVersionUrl: config.unmsLatestVersionUrl,
        updateVersionOverride: webPlugin.getUpdateVersionOverride(),
      });
    },
  });

  server.route({
    path: '/v2.0/nms/settings',
    method: 'GET',
    handler(request, reply) {
      reply(settings);
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      path: '/v2.1/nms/settings',
      method: 'GET',
      handler(request, reply) {
        reply(settings);
      },
    });
  }


  server.route({
    path: '/v2.0/nms/settings',
    method: 'PUT',
    config: {
      validate: {
        payload: Joi.object().keys({
          hostname: Validation.hostname,
          autoBackups: Joi.boolean().required(),
          mapsProvider: Joi.string().valid(...values(enums.MapsProviderEnum)).required(),
          googleMapsApiKey: Joi.string().allow(null),
          devicePingAddress: Joi.alternatives().try(Joi.string().ip(), Joi.string().hostname()).allow(null),
          devicePingIntervalNormal: Joi.number().min(10000).max(200000).allow(null),
          devicePingIntervalOutage: Joi.number().min(2000).max(100000).allow(null),
          allowLoggingToSentry: Joi.boolean(),
          allowLoggingToLogentries: Joi.boolean(),
        }),
      },
    },
    handler(request, reply) {
      reply(settings);
    },
  });

  server.route({
    path: '/v2.0/nms/update',
    method: 'PUT',
    config: {
      validate: {
        payload: Joi.object().keys({
          version: Joi.string().required(),
        }),
      },
    },
    handler(request, reply) {
      reply({ result: true, message: 'Update process initiated.' });
    },
  });


  server.route({
    path: '/v2.0/nms/update',
    method: 'GET',
    handler(request, reply) {
      reply({ isNmsUpdating: true, canUpdate: true });
    },
  });

  // FOR DEVELOP ONLY, NMS DOES NOT USE SUCH ENDPOINT
  server.route({
    path: '/v2.0/nms/return-version',
    method: 'GET',
    handler(request, reply) {
      reply({ version: '0.20.0' });
    },
  });


  server.route({
    method: 'GET',
    path: '/v2.0/nms/maintenance/backup',
    config: {
      validate: {
        query: {
          retention: Joi.any().valid('7', '30', '60', '90', '180', '365', '-1').required(),
        },
      },
    },
    handler(request, reply) {
      reply(' --- not supported in demo version ---').type('application/txt');
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/nms/maintenance/backup',
    config: {
      timeout: {
        socket: false,
      },
      payload: {
        timeout: false,
        output: 'file',
        parse: true,
        allow: 'multipart/form-data',
        maxBytes: config.nmsBackup.fileMaxBytes,
      },
    },
    handler(request, reply) {
      reply({ result: true, message: 'Backup file saved.' });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/nms/maintenance/backup/restore',
    handler(request, reply) {
      reply({ result: true, message: 'Backup file restored' });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/nms/maintenance/supportinfo',
    handler(request, reply) {
      reply(' --- not supported in demo version ---').type('application/zip');
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/nms/mailserver',
    handler(request, reply) {
      reply({});
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/nms/mailserver',
    config: {
      validate: {
        payload: Validation.smtp,
      },
    },
    handler(request, reply) {
      reply({});
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/nms/mailserver/test',
    config: {
      validate: {
        payload: {
          to: Joi.string().email().required(),
          smtp: Validation.smtp,
        },
      },
    },
    handler(request, reply) {
      reply({ result: true, message: 'Testing email sent.' });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/nms/summary',
    config: {
      validate: {
        query: {
          outagesTimestamp: Joi.date().timestamp('javascript').raw(),
          logsTimestamp: Joi.date().timestamp('javascript').raw(),
          firmwaresTimestamp: Joi.date().timestamp('javascript').raw(),
          logsLevel: Joi.array().items(
            Joi.string().valid(...values(enums.LogLevelEnum))
          ).required(),
        },
      },
    },
    handler(request, reply) {
      reply({
        devicesUnauthorizedCount: getUnauthorizedDevicesCount(devices),
        logsUnreadCount: 1,
        outagesUnreadCount: 1,
      });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/nms/news',
    config: {
      description: 'Get news from UNMS feed for user',
      tags: ['api', 'nms'],
    },
    handler(request, reply) {
      reply([]);
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/nms/statistics',
    config: {
      description: 'Get UNMS network statistics.',
      tags: ['api', 'nms'],
    },
    handler(request, reply) {
      reply(getNMSStatistics(request.query.interval, sites));
    },
  });
}


/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'nms_v2.0',
  version: '1.0.0',
  dependencies: ['web'],
};
