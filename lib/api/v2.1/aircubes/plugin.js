'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { DB } = require('../../../db');
const { registerRoutes } = require('./routes');
const { airCubeDetail, listStations } = require('./service');
const { deviceDetail, stations } = require('./view');


function register(server, options) {
  const { deviceStore, firmwareDal, dal } = server.plugins;
  const airCubeDetailBound = weave(airCubeDetail, { DB, deviceStore, firmwareDal, dal });
  const listStationsBound = weave(listStations, { deviceStore });
  const service = {
    airCubeDetail: airCubeDetailBound,
    listStations: listStationsBound,
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
  name: 'apiAirCubesV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'firmwareDal'],
};
