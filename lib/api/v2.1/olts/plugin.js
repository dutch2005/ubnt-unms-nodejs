'use strict';

/*
 * Hapijs Plugin definition
 */

const { curry, pick } = require('ramda');
const { weave, weaveLazy } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const {
  oltList, oltDetail, onuProfileList, createOnuProfile, updateOnuProfile, deleteOnuProfile, getOnuPolicies,
  setOnuPolicies,
} = require('./service');

const lazyConfig = curry((pluginNames, server) => () => pick(pluginNames, server.plugins));

function register(server, options) {
  const { DB, firmwareDal, deviceStore, dal } = server.plugins;
  const service = {
    oltList: weave(oltList, { DB, firmwareDal }),
    oltDetail: weave(oltDetail, { DB, firmwareDal, dal }),
    onuProfileList: weaveLazy(onuProfileList, lazyConfig(['apiOnusV2.1', 'deviceStore'], server)),
    createOnuProfile: weave(createOnuProfile, { deviceStore }),
    updateOnuProfile: weave(updateOnuProfile, { deviceStore }),
    deleteOnuProfile: weave(deleteOnuProfile, { deviceStore }),
    getOnuPolicies: weave(getOnuPolicies, { deviceStore }),
    setOnuPolicies: weave(setOnuPolicies, { deviceStore }),
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiOltsV2.1',
  version: '2.1.0',
  dependencies: ['deviceStore', 'firmwareDal', 'DB', 'dal'],
};
