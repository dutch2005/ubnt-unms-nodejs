'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const { airMaxDetail, airMaxStations } = require('./service');
const { deviceDetail, stations } = require('./view');


function register(server, options) {
  const { deviceStore, DB, firmwareDal, dal } = server.plugins;
  const airMaxDetailBound = weave(airMaxDetail, { DB, deviceStore, firmwareDal, dal });
  const airMaxStationsBound = weave(airMaxStations, { deviceStore, DB });
  const service = {
    airMaxDetail: airMaxDetailBound,
    airMaxStations: airMaxStationsBound,
  };

  const view = {
    deviceDetail: weave(deviceDetail, { service }),
    stations: weave(stations, { service }),
  };

  server.expose(service);

  registerRoutes(server, options, view);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiAirMaxesV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'DB', 'firmwareDal'],
};
