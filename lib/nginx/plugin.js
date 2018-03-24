'use strict';

const { weave } = require('ramda-adjunct');
const requestPromise = require('request-promise-native');

const { registerPlugin } = require('../util/hapi');
const { updateSslCertificate } = require('./index');
const config = require('../../config');

function register(server) {
  const { DB, logging, scheduler, eventLog } = server.plugins;

  const pluginApi = {
    updateSslCertificate: weave(updateSslCertificate, { DB, config, logging, eventLog, requestPromise }),
  };

  server.expose(pluginApi);

  const renewCertificate = () => updateSslCertificate(null).run({ DB, config, logging, eventLog, requestPromise });

  // register periodic tasks
  scheduler.registerDailyTask(renewCertificate, 'renewCertificate');

  return renewCertificate();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'nginx',
  dependencies: ['DB', 'logging', 'scheduler', 'eventLog'],
};
