'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../util/hapi');
const { registerRoutes } = require('./routes');
const { getAesKeys, getDiscoveryResults } = require('./service');


function register(server, options) {
  const { DB, dal, discovery, settings, deviceStore, firmwareDal } = server.plugins;

  /**
   * @name E2EService
   * @type {{
   *    getAesKeys: function():Promise.<CorrespondenceMacAesKey[]>,
   *    getDiscoveryResults: function():Promise.<CorrespondenceDiscoveryResult[]>,
   * }}
   */
  const service = {
    getAesKeys: weave(getAesKeys, { dal }),
    getDiscoveryResults: weave(getDiscoveryResults, { DB, dal, discovery, settings, deviceStore, firmwareDal }),
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'e2e',
  version: '1.0.0',
  dependencies: ['DB', 'dal', 'discovery', 'settings', 'deviceStore', 'firmwareDal'],
};
