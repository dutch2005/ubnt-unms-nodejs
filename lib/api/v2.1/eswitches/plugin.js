'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { DB } = require('../../../db');
const service = require('./service');
const { registerRoutes } = require('./routes');


function register(server, options) {
  const { deviceStore, firmwareDal, dal } = server.plugins;

  const eswitchDetailBound = weave(service.eswitchDetail, { DB, deviceStore, firmwareDal, dal });

  const eswitchesService = {
    eswitchDetail: eswitchDetailBound,
  };

  registerRoutes(server, options, eswitchesService);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiEswitchesV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'firmwareDal'],
};
