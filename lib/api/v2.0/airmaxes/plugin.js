'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const { airMaxDetail, airMaxStations } = require('./service');


function register(server, options) {
  const { fixtures } = server.plugins;
  const airMaxDetailBound = weave(airMaxDetail, { fixtures });
  const airMaxStationsBound = weave(airMaxStations, { fixtures });
  const service = {
    airMaxDetail: airMaxDetailBound,
    airMaxStations: airMaxStationsBound,
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiAirMaxesV2.0',
  version: '2.0.0',
  dependencies: ['fixtures'],
};
