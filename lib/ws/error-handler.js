'use strict';

const { Reader: reader } = require('monet');

const {
  DecryptionFailedError, MessageParsingFailedError, RpcTimeoutError, ConnectionClosedError,
} = require('./errors');
const { DeviceConnectionFailedReasonEnum } = require('../enums');

const errorHandler = (error, connection) => reader(
  ({ messageHub }) => {
    const messages = messageHub.messages;
    if (error instanceof DecryptionFailedError) {
      messageHub.publish(messages.deviceConnectionFailure(
        error.deviceId,
        DeviceConnectionFailedReasonEnum.Decryption,
        error.remoteAddress
      ));
      connection.logWarning(error);
    } else if (error instanceof MessageParsingFailedError || error instanceof ConnectionClosedError) {
      connection.logWarning(error);
    } else if (error instanceof RpcTimeoutError) {
      connection.log(error.message);
    } else if (error instanceof Error) {
      connection.logError(error);
    }

    return error; // propagate error
  }
);

module.exports = errorHandler;
