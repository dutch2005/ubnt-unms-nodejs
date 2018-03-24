'use strict';

const { weave } = require('ramda-adjunct');

const {
  saveOutages, stopOutage, deviceDisconnected, deviceConnected, cleanOldOutages, getOutages, initOutages,
  stopOutageOnDeviceRemoved,
} = require('./index');
const { registerPlugin } = require('../util/hapi');
const { toMs } = require('../util');
const handlers = require('./handlers');


/*
 * Hapi plugin definition
 */
function register(server) {
  const { DB, logging, store, dal, settings, messageHub, scheduler, eventLog } = server.plugins;
  const config = server.settings.app;

  const pluginApi = {
    saveOutages: weave(saveOutages, { store, dal, logging, settings, DB, eventLog }),
    stopOutage: weave(stopOutage, { store, dal, logging, settings, DB, eventLog, messageHub }),
    stopOutageOnDeviceRemoved: weave(stopOutageOnDeviceRemoved, { DB, store, logging, dal, settings }),
    deviceDisconnected: weave(deviceDisconnected, { store }),
    deviceConnected: weave(deviceConnected,
      { store, dal, logging, settings, DB, eventLog, messageHub }
    ),
    getOutages: weave(getOutages, { store }),
    cleanOldOutages: weave(cleanOldOutages, { dal, logging, settings }),
  };

  server.expose(pluginApi);

  messageHub.registerHandlers(handlers);

  if (!config.demo) {
    scheduler.registerDailyTask(pluginApi.cleanOldOutages, 'cleanOldOutages');
    scheduler.registerPeriodicTask(pluginApi.saveOutages, toMs('seconds', 5), 'saveOutages');
  }

  return initOutages().run({ DB, store, dal });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'outages',
  version: '1.0.0',
  dependencies: ['store', 'messageHub', 'settings', 'DB', 'dal', 'logging', 'eventLog', 'scheduler'],
};
