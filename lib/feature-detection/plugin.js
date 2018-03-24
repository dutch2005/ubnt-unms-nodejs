'use strict';

const { registerPlugin } = require('../util/hapi');
const common = require('./common');
const firmware = require('./firmware');
const poe = require('./poe');
const statistics = require('./statistics');
const vlan = require('./vlan');


function register(server) {
  server.expose('common', common);
  server.expose('firmware', firmware);
  server.expose('poe', poe);
  server.expose('statistics', statistics);
  server.expose('vlan', vlan);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'featureDetection',
  version: '1.0.0',
};
