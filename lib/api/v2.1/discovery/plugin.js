'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const service = require('./service');
const { DB } = require('../../../db');


function register(server, options) {
  const { dal, firmwareDal, discovery, deviceStore, settings } = server.plugins;
  const { discoveryScanTimeout, unmsHostname } = settings;

  /**
   * @name ApiDiscovery
   * @type {{
   *  discoveryResult,
   *  removeDiscoveryResult,
   *  startDiscoveryScan,
   *  stopDiscoveryScan,
   *  assignCredentials,
   *  connectDevices,
   *  suggestIpRange,
   * }}
   */
  const discoveryService = {
    discoveryResult: weave(service.discoveryResult, { dal, DB, deviceStore, discovery, firmwareDal }),
    removeDiscoveryResult: weave(service.removeDiscoveryResult, { dal }),
    startDiscoveryScan: weave(service.startDiscoveryScan, { dal, discovery, discoveryScanTimeout }),
    stopDiscoveryScan: weave(service.stopDiscoveryScan, { dal, DB, deviceStore, firmwareDal, discovery }),
    assignCredentials: weave(service.assignCredentials, { dal, DB, deviceStore, discovery }),
    connectDevices: weave(service.connectDevices, { dal, DB, deviceStore, discovery }),
    suggestIpRange: weave(service.suggestIpRange, { DB, discovery, unmsHostname }),
  };

  server.expose(discoveryService);

  registerRoutes(server, options, discoveryService);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiDiscoveryV2.1',
  dependencies: ['dal', 'discovery', 'settings', 'deviceStore', 'firmwareDal'],
};
