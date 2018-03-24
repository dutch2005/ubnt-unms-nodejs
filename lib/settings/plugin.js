'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const settings = require('./index');
const handlers = require('./handlers');

/*
 * Hapi plugin definition
 */
function register(server) {
  const { messageHub, DB } = server.plugins;

  server.expose('firmwares', settings.firmwares);

  const pluginApi = Object.assign({}, settings, {
    loadSettings: weave(settings.loadSettings, { DB }),
  });
  server.expose(pluginApi);

  messageHub.registerHandlers(handlers);

  // make sure settings are loaded.
  return pluginApi.loadSettings();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'settings',
  version: '1.0.0',
  dependencies: ['messageHub', 'DB'],
};
