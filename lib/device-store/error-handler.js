'use strict';

const { Observable } = require('rxjs/Rx');

const { toMs } = require('../util');
const { DeviceInvalidError, UnknownDeviceError } = require('./errors');

const CONNECTION_HOLD_DELAY = toMs('seconds', 20);

// hold connection to prevent immediate reconnect
const holdAndCloseConnection = connection => Observable.timer(CONNECTION_HOLD_DELAY)
  .mergeMap(() => connection.close())
  .mergeMapTo(Observable.empty());

const errorHandler = (error, connection) => {
  if (error instanceof DeviceInvalidError || error instanceof UnknownDeviceError) {
    connection.logWarning(error);
    return holdAndCloseConnection(connection);
  }

  return error; // propagate error
};

module.exports = errorHandler;
