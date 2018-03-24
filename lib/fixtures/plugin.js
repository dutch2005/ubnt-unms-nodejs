'use strict';

const { registerPlugin } = require('../util/hapi');
const siteRepository = require('./site');
const deviceRepository = require('./device');

function register(server) {
  const siteFixtures = siteRepository.generateSitesAndEndpoints();
  const deviceFixtures = deviceRepository.generateDevices(siteFixtures);

  /**
   * Added aliases for pre-generated data as `fixtures` or `data`. It is confusing to use
   * `fixtures.devices.devices` in higher-level APIs. Rather it makes more sense to use
   * `fixtures.devices.data` or `fixtures.devices.fixtures`, in the sense that fixtures are pre-generated data.
   *
   * WARNING: Pre-generated data has API format.
   *
   * In future, it would be more appropriate for repositories to return data in correspondence format.
   */

  server.expose('sites', Object.assign({
    sites: siteFixtures, // for backward compatibility only
    fixtures: siteFixtures,
    data: siteFixtures,
  }, siteRepository));
  server.expose('devices', Object.assign({
    devices: deviceFixtures, // for backward compatibility only
    fixtures: deviceFixtures,
    data: deviceFixtures,
  }, deviceRepository));
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'fixtures',
};
