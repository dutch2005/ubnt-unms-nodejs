'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const { toMs } = require('../util');
const { saveDeviceLog } = require('./service');

function register(server) {
  const config = server.settings.app;
  const { store, scheduler } = server.plugins;

  const pluginApi = {
    saveDeviceLog: weave(saveDeviceLog, { store }),
  };

  server.expose(pluginApi);

  // register periodic tasks
  if (!config.demo) {
    scheduler.registerPeriodicTask(pluginApi.saveDeviceLog, toMs('seconds', 5), 'saveDeviceLog');
  }
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'deviceLog',
  version: '1.0.0',
  dependencies: ['store', 'scheduler'],
};
