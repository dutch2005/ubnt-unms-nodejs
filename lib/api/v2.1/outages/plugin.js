'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const { outageItemList, countUnread } = require('./service');


function register(server, options) {
  const { dal, DB, outages } = server.plugins;

  const service = {
    outageItemList: weave(outageItemList, { DB, dal, outages }),
    countUnread: weave(countUnread, { dal }),
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiOutagesV2.1',
  version: '2.1.0',
  dependencies: ['dal', 'outages', 'DB'],
};
