'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const { toMs } = require('../util');

const handlers = require('./handlers');
const service = require('./service');

function register(server) {
  const { DB, deviceStore, messageHub, logging, scheduler } = server.plugins;
  const config = server.settings.app;

  // register periodic tasks
  if (!config.demo) {
    scheduler.registerPeriodicTask(
      weave(service.synchronizeSitesStatus, { DB, deviceStore, logging }),
      toMs('minute', 3),
      'synchronizeSitesStatus'
    );
  }

  server.expose({
    synchronizeSiteStatus: weave(service.synchronizeSiteStatus, { DB, deviceStore, logging }),
  });

  messageHub.registerHandlers(handlers);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'site',
  version: '1.0.0',
  dependencies: ['DB', 'deviceStore', 'messageHub', 'scheduler', 'logging'],
};
