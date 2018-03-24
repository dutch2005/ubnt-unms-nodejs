'use strict';

const { Server: WebSocketServer } = require('uws');
const { Observable } = require('rxjs/Rx');
const { is, anyPass } = require('ramda');
const { weave } = require('ramda-adjunct');

const { wsPort } = require('../../config');
const { registerPlugin } = require('../util/hapi');
const {
  RpcError, RpcTimeoutError, DecryptionFailedError, InvalidMessageError, MessageParsingFailedError,
  ConnectionClosedError,
} = require('./errors');
const errorHandler = require('./error-handler');
const Guard = require('./guard');

const { createConnection, setupConnection } = require('./connection-factory');

const isExpectedError = anyPass([
  is(RpcTimeoutError),
  is(RpcError),
  is(DecryptionFailedError),
  is(InvalidMessageError),
  is(MessageParsingFailedError),
  is(ConnectionClosedError),
]);

const GUARD_CONFIG = {
  interval: 500,
  maxHeapUsedBytes: 1e9, // 1 GB
  maxRssBytes: 1.5e9, // 1.5 GB
  maxEventLoopDelay: 500, // 500 milliseconds
};

const startServer = (server) => {
  const { logging, settings, deviceStore, messageHub, macAesKeyStore } = server.plugins;

  const guard = new Guard(GUARD_CONFIG, logging);
  const wss = new WebSocketServer({
    port: wsPort,
    verifyClient: (options, callback) => guard.verifyClient(options, callback),
    noDelay: true,
  }, () => {
    const { port, address } = wss.httpServer.address();
    logging.info(`WS server running at: http://${address}:${port}`);
  });

  const errorHandlerMiddleware = {
    handleError: weave(errorHandler, { messageHub }),
  };
  const connectionDependencies = { logging, settings, deviceStore, macAesKeyStore, errorHandlerMiddleware };

  const createConnectionBound = weave(createConnection, connectionDependencies);

  const connections$ = Observable.fromEvent(wss, 'connection')
    .mergeMap(ws => Observable.using(() => createConnectionBound(ws), setupConnection)
      .catch((error) => {
        if (!isExpectedError(error)) {
          logging.error('Unexpected connection error', error);
        }
        return Observable.empty(); // don't stop server on error
      })
    );
  const errors$ = Observable.fromEvent(wss, 'error').mergeMap(Observable.throw);
  const close$ = Observable.fromEvent(wss, 'close').take(1);

  guard.start();
  return Observable.merge(connections$, errors$)
    .finally(() => {
      // cleanup logic
      wss.close();
      guard.stop();
    })
    .takeUntil(close$);
};

/*
 * Hapi plugin definition
 */
function register(server) {
  Observable.fromEvent(server, 'start')
    .mergeMap(() => startServer(server))
    .takeUntil(Observable.fromEvent(server, 'stop'))
    .subscribe();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'socket',
  version: '1.0.0',
  dependencies: ['settings', 'messageHub', 'deviceStore', 'logging', 'macAesKeyStore'],
};
