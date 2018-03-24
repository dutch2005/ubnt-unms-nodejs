'use strict';

const { bindAll } = require('lodash/fp');

const { registerPlugin } = require('../util/hapi');
const DeviceSettings = require('./settings');
const handlers = require('./handlers');

/*
 * Hapi plugin definition
 */
function register(server) {
  const { DB, settings, messageHub } = server.plugins;

  const deviceSettings = new DeviceSettings(settings, DB);

  server.expose(bindAll([
    'getInterval', 'hasOverride', 'updateSettings', 'loadSettings',
  ], deviceSettings));

  messageHub.registerHandlers(handlers);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'deviceSettings',
  version: '1.0.0',
  dependencies: ['messageHub'],
};
