'use strict';

const { Reader: reader } = require('monet');
const { once } = require('lodash/fp');
const { pipe, when, isNil } = require('ramda');
const glue = require('glue');

const { tapP, resolveP } = require('./lib/util');

// default route configuration - disable response validation
const routes = { response: { failAction: 'log', sample: 0 } };

const createManifest = ({ goodConfig, sequelize, model, config }) => {
  const commonPlugins = [
    { plugin: { register: 'good', options: goodConfig.https } },
    { plugin: { register: 'inert' } },
    {
      plugin: {
        register: './lib/views/plugin',
        options: { templatePaths: config.templatePaths, demo: config.demo },
      },
    },
    {
      plugin: {
        register: './lib/web/plugin',
        options: { model, publicPaths: config.publicPaths, publicDir: config.publicDir },
      },
    },
    { plugin: { register: './lib/util/plugin' } },
    { plugin: { register: './lib/fixtures/plugin', options: { model } } },
    { plugin: { register: './lib/scheduler/plugin' } },
    { plugin: { register: './lib/logging/plugin' } },
    { plugin: { register: './lib/store/plugin' } },
    { plugin: { register: './lib/api-docs/plugin', options: { demo: config.demo } } },
  ];

  const corePlugins = [
    { plugin: { register: './lib/sequelize/plugin', options: { sequelize } } },
    { plugin: { register: './lib/db/plugin' } },
    {
      plugin: {
        register: './lib/message-hub/plugin',
        options: config.rabbitMQ,
      },
    },
    { plugin: { register: './lib/settings/plugin' } },
    { plugin: { register: './lib/mail/plugin' } },
    { plugin: { register: './lib/statistics/plugin' } },
    { plugin: { register: './lib/dal/plugin' } },
    { plugin: { register: './lib/device-log/plugin' } },
    { plugin: { register: './lib/user/plugin' } },
    { plugin: { register: './lib/event-log/plugin' } },
    { plugin: { register: './lib/nginx/plugin' } },
    { plugin: { register: './lib/device-settings/plugin' } },
    { plugin: { register: './lib/device-store/plugin' } },
    { plugin: { register: './lib/site/plugin' } },
    { plugin: { register: './lib/mac-aes-key-store/plugin' } },
    { plugin: { register: './lib/feature-detection/plugin' } },
    { plugin: { register: './lib/firmware-dal/plugin', options: config.firmwares } },
    { plugin: { register: './lib/backups/plugin', options: { model } } },
    { plugin: { register: './lib/discovery/plugin' } },
    { plugin: { register: './lib/tasks/plugin' } },
    { plugin: { register: './lib/update/plugin' } },
    { plugin: { register: './lib/data-link/plugin' } },
    { plugin: { register: './lib/outages/plugin' } },
    { plugin: { register: './lib/unms-statistics/plugin' } },
    { plugin: { register: './lib/device-events/plugin' } },
    {
      plugin: {
        register: 'hapi-rate-limit',
        options: {
          enabled: false,
          checkUnauthorized: true,
          pathLimit: false,
          userPathLimit: true,
          userCache: { expiresIn: config.apiRateLimit.userCacheExpiresIn },
        },
      },
    },
    { plugin: { register: './lib/auth/plugin' } },
    { plugin: { register: './lib/ws/plugin', options: { model } } },
  ];

  // v2.0 API
  const mockApiV2Plugins = allowAccessWithoutLogin => ([
    { plugin: { register: './lib/api/v2.0/sites', options: { model } } },
    { plugin: { register: './lib/api/v2.0/devices', options: { model } } },
    { plugin: { register: './lib/api/v2.0/erouters', options: { model } } },
    { plugin: { register: './lib/api/v2.0/eswitches', options: { model } } },
    { plugin: { register: './lib/api/v2.0/olts', options: { model } } },
    { plugin: { register: './lib/api/v2.0/onus', options: { model } } },
    { plugin: { register: './lib/api/v2.0/aircubes/plugin', options: { model } } },
    { plugin: { register: './lib/api/v2.0/airmaxes/plugin', options: { model } } },
    { plugin: { register: './lib/api/v2.0/interfaces', options: { model } } },
    { plugin: { register: './lib/api/v2.0/users', options: { model } } },
    { plugin: { register: './lib/api/v2.0/user', options: { model, allowAccessWithoutLogin } } },
    { plugin: { register: './lib/api/v2.0/nms', options: { model, allowAccessWithoutLogin } } },
    { plugin: { register: './lib/api/v2.0/logs', options: { model } } },
    { plugin: { register: './lib/api/v2.0/outages', options: { model } } },
    { plugin: { register: './lib/api/v2.0/discovery', options: { model } } },
    { plugin: { register: './lib/api/v2.0/firmwares', options: { model } } },
    { plugin: { register: './lib/api/v2.0/tasks', options: { model } } },
  ]);

  // v2.1 API
  const prodApiV2Plugins = [
    /* eslint-disable max-len */
    { plugin: { register: './lib/api/v2.1/users/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/user/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/sites/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/devices/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/erouters/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/eswitches/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/olts/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/onus/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/airmaxes/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/aircubes/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/interfaces/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/setup/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/nms/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/logs/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/outages/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/discovery/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/firmwares/plugin', options: { model, routes } } },
    { plugin: { register: './lib/api/v2.1/tasks/plugin', options: { model, routes } } },
    /* eslint-enable max-len */
  ];

  const e2eApiPlugins = [
    /* eslint-disable max-len */
    { plugin: { register: './lib/api/e2e/plugin', options: { model, routes } } },
    /* eslint-enable max-len */
  ];

  const registrations = (
    config.demo
      ? commonPlugins
      .concat(mockApiV2Plugins(true))
      : commonPlugins
      .concat(corePlugins)
      .concat(mockApiV2Plugins(false))
      .concat(prodApiV2Plugins)
  );

  if (config.isTest) {
    registrations.push(...e2eApiPlugins);
  }

  return {
    server: { app: config },
    connections: [config.httpConnection],
    registrations,
  };
};

const options = {
  relativeTo: __dirname,
};

const startServer = () => reader(
  ({ goodConfig, sequelize, model, enums, config, logging }) => {
    logging.info('Registering plugins');
    return glue.compose(createManifest({ goodConfig, sequelize, model, enums, config }), options)
      .then(tapP((server) => {
        logging.info('Plugin registration finished');

        const stopServer = () => {
          logging.info('Received process termination signal. Stopping server...');
          server.stop()
            .then(() => sequelize.close())
            .then(() => process.exit())
            .catch(() => logging.error('Failed to stop server'));
        };

        logging.info('Starting webservers');
        return server.start()
          .then(() => {
            process.on('SIGTERM', stopServer);
            process.on('SIGINT', stopServer);
            logging.info(`HTTP server running at: ${server.info.uri}`);
          });
      }));
  });

const bootstrap = () => reader(
  ({ goodConfig, sequelize, model, enums, config, store, logging }) => pipe(
    when(isNil, () => { throw new Error('NODE_ENV variable has to be present. Check README for more info.') }),
    () => resolveP(startServer().run({ goodConfig, sequelize, model, enums, config, store, logging }))
      .then(server => server.plugins.store.set(['serverMeta', 'startTimestamp'], Date.now()))
  )(process.env.NODE_ENV)
);

module.exports = {
  bootstrap: once(bootstrap),
};
