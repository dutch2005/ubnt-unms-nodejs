'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { cond, eq, T, constant } = require('lodash/fp');

const { WebSocketProtocolEnum } = require('../enums');
const WebSocketConnection = require('./connection');

const ProtocolV1 = require('./protocols/v1');
const ProtocolV2 = require('./protocols/v2');

const jsonMiddleware = require('./middlewares/json');
const parserMiddleware = require('./middlewares/parser');
const mapperMiddleware = require('./middlewares/mapper');

const toVersion = cond([
  [eq(WebSocketProtocolEnum.V2), constant(ProtocolV2.VERSION)],
  [T, constant(ProtocolV1.VERSION)],
]);

const createConnection = ws => reader(
  ({ deviceStore, logging, settings, macAesKeyStore, errorHandlerMiddleware }) => {
    const request = ws.upgradeReq;
    const protocol = request.headers['sec-websocket-protocol'];
    const connection = new WebSocketConnection(ws, request, protocol, logging);

    switch (protocol) {
      case WebSocketProtocolEnum.V2:
        connection.use(new ProtocolV2(macAesKeyStore, settings.aesKey, connection.remoteAddress));
        break;
      case WebSocketProtocolEnum.V1:
        connection.use(new ProtocolV1(settings.aesKey));
        break;
      default:
        return connection;
    }

    connection.use(errorHandlerMiddleware);
    connection.use(jsonMiddleware); // parse decrypted message to json
    connection.use(parserMiddleware); // handle message parsing
    connection.use(mapperMiddleware(toVersion(protocol))); // format messages
    connection.use(deviceStore.bootstrapMiddleware);

    return connection;
  }
);

const setupConnection = connection => Observable.of(connection)
  .merge(connection.error$)
  .concatMap(() => connection.establish())
  .takeUntil(connection.close$);

module.exports = { createConnection, setupConnection };
