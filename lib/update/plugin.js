'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const { toMs } = require('../util');
const { requestNmsUpdate, checkNmsUpdateProgress, getNmsUpdateStatus, checkNmsUpdateResult } = require('./index');

function register(server) {
  const { scheduler, backups, DB, eventLog, logging } = server.plugins;
  const config = server.settings.app;

  const pluginApi = {
    requestNmsUpdate: weave(requestNmsUpdate, { config, backups, DB, logging, eventLog }),
    checkNmsUpdateProgress: weave(checkNmsUpdateProgress, { config, logging }),
    getNmsUpdateStatus: weave(getNmsUpdateStatus, { config, logging }),
  };

  server.expose(pluginApi);

  // register periodic tasks
  if (!config.demo) {
    scheduler.registerPeriodicTask(pluginApi.checkNmsUpdateProgress, toMs('seconds', 5), 'checkNmsUpdateProgress');
  }

  return checkNmsUpdateResult().run({ DB, eventLog });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'update',
  version: '1.0.0',
  dependencies: ['scheduler', 'backups', 'eventLog', 'DB', 'logging'],
};
