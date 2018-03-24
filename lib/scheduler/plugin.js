'use strict';

const { registerPlugin } = require('../util/hapi');

const Scheduler = require('./scheduler');

/*
 * Hapi plugin definition
 */
function register(server) {
  const scheduler = new Scheduler();

  server.expose({
    registerPeriodicTask: scheduler.registerPeriodicTask.bind(scheduler),
    registerDailyTask: scheduler.registerDailyTask.bind(scheduler),
  });

  server.once('stop', () => scheduler.destroy());
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'scheduler',
  version: '1.0.0',
  dependencies: [],
};
