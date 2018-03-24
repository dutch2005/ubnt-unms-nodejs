'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const { toMs } = require('../util');
const { logUnmsStatistics } = require('./service');


function register(server) {
  const { user, DB, scheduler, store, dal, logging } = server.plugins;
  const serviceBound = {
    logUnmsStatistics: weave(logUnmsStatistics, { user, DB, store, dal, logging }),
  };

  scheduler.registerPeriodicTask(serviceBound.logUnmsStatistics, toMs('hour', 8), 'logUnmsStatistics');

  server.expose(serviceBound);
}


exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'unmsStatistics',
  version: '1.0.0',
  dependencies: ['user', 'DB', 'scheduler', 'store', 'dal', 'logging'],
};
