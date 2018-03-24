'use strict';

const { partial } = require('lodash');

const { registerPlugin } = require('../util/hapi');
const { log, info, debug, error, packLogs, setLogFunction } = require('./index');
const { cleanLogsDir } = require('./cleanup');

const serverLog = (serverInstance, ...args) => serverInstance.log(...args);

function register(server) {
  const config = server.settings.app;
  const { scheduler } = server.plugins;
  server.on('start', () => setLogFunction(partial(serverLog, server)));
  server.on('stop', () => setLogFunction(console.log));

  server.expose({ log, info, debug, error, packLogs });

  // register periodic tasks
  if (!config.demo) {
    scheduler.registerDailyTask(cleanLogsDir, 'cleanLogsDir');
  }
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'logging',
  version: '1.0.0',
  dependencies: ['scheduler'],
};
