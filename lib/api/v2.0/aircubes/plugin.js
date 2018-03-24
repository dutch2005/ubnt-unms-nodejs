'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const { airCubeDetail, airCubeStations } = require('./service');

/*
 * Hapijs Plugin definition
 */
function register(server, options) {
  const { fixtures } = server.plugins;
  const airCubeDetailBound = weave(airCubeDetail, { fixtures });
  const airCubeStationsBound = weave(airCubeStations, { fixtures });
  const service = {
    airCubeDetail: airCubeDetailBound,
    airCubeStations: airCubeStationsBound,
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiAirCubesV2.0',
  version: '2.0.0',
  dependencies: ['fixtures'],
};
