'use strict';

const { bindAll } = require('lodash/fp');

const { registerPlugin } = require('../util/hapi');
const handlers = require('./handlers');
const DeviceEventQueue = require('./queue');

const erouterEventHandlers = require('./erouter');
const eswitchEventHandlers = require('./eswitch');
const oltEventHandlers = require('./olt');
const airmaxEventHandlers = require('./airmax');
const aircubeEventHandlers = require('./aircube');

/*
 * Hapi plugin definition
 */
function register(server) {
  const { logging, messageHub } = server.plugins;

  const deviceQueue = new DeviceEventQueue(logging);

  erouterEventHandlers(server, deviceQueue);
  eswitchEventHandlers(server, deviceQueue);
  oltEventHandlers(server, deviceQueue);
  airmaxEventHandlers(server, deviceQueue);
  aircubeEventHandlers(server, deviceQueue);

  server.expose(bindAll(['add'], deviceQueue));

  messageHub.registerHandlers(handlers);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'deviceEvents',
  dependencies: ['DB', 'logging', 'messageHub', 'eventLog'],
};
