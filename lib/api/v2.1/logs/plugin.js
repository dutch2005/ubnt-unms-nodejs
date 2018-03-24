'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const { logItemList, countUnread } = require('./service');


function register(server, options) {
  const { dal } = server.plugins;

  const service = {
    logItemList: weave(logItemList, { dal }),
    countUnread: weave(countUnread, { dal }),
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiLogsV2.1',
  version: '2.1.0',
  dependencies: ['dal'],
};
