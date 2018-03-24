'use strict';

const { Observable } = require('rxjs/Rx');
const Boom = require('boom');
const { isNull } = require('lodash/fp');
const { when } = require('ramda');
const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');

const { DeviceNotFoundError, NotImplementedError } = require('./errors');
const { RpcError, RpcTimeoutError } = require('../ws/errors');
const DeviceStore = require('./store');
const bootstrapConnection = require('./bootstrap-connection');
const errorHandler = require('./error-handler');
const PeriodicActions = require('./periodic-actions');
const { updateUpgradeStatus } = require('./upgrade-status');

/**
 * @typedef {Object} DeviceStore
 * @property {Function} findAll
 * @property {Function} exists
 * @property {Function} findById
 * @property {Function} get
 * @property {Function} add
 * @property {Function} remove
 * @property {PeriodicActions} periodicActions
 * @property {Object} bootstrapMiddleware
 */

function register(server) {
  const { messageHub, DB, deviceSettings, settings, logging } = server.plugins;

  const store = new DeviceStore();
  const periodicActions = new PeriodicActions(deviceSettings, logging);

  const dependencies = { messageHub, settings, logging, store, deviceSettings, periodicActions };

  server.expose({
    findAll: store.findAll.bind(store),
    exists: store.exists.bind(store),
    findById: store.findById.bind(store),
    get: store.get.bind(store),
    add: store.add.bind(store),
    remove: store.remove.bind(store),
  });

  server.expose({
    bootstrapMiddleware: {
      handleEstablish: weave(bootstrapConnection, dependencies),
      handleError: errorHandler,
    },
    // @deprecated
    runCommand: (deviceId, command) => Observable.of(store.get(deviceId))
      .do(when(isNull, () => { throw new DeviceNotFoundError() }))
      .mergeMap(commDevice => commDevice.runCommand(command)),
    // @deprecated
    updateUpgradeStatus: (deviceId, payload) => updateUpgradeStatus(deviceId, payload)
      .run({ DB })
      .catch(() => Observable.empty())
      .toPromise(),
    // @deprecated
    updateOnuUpgradeStatus: (oltId, onuId, payload) => updateUpgradeStatus(onuId, payload)
      .run({ DB })
      .catch(() => Observable.empty())
      .toPromise(),
  });

  server.expose('periodicActions', periodicActions);

  server.once('stop', () => {
    periodicActions.destroy();
  });

  // translate socket errors to Boom
  // TODO(michal.sedlak@ubnt.com): We should probably move translation of WS errors somewhere else.
  server.ext('onPreResponse', (request, reply) => {
    const response = request.response;
    if (!response.isBoom) { // if not error then continue
      return reply.continue();
    }

    if (response instanceof RpcError) {
      return reply(Boom.badData(response.error));
    }

    if (response instanceof RpcTimeoutError) {
      return reply(Boom.serverUnavailable());
    }

    if (response instanceof DeviceNotFoundError) {
      return reply(Boom.notFound(response.message));
    }

    if (response instanceof NotImplementedError) {
      return reply(Boom.notImplemented(response.message));
    }

    return reply.continue();
  });
}

/*
 * Hapijs Plugin definition
 */

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'deviceStore',
  version: '1.0.0',
  dependencies: ['settings', 'DB', 'deviceSettings', 'logging', 'messageHub'],
};
