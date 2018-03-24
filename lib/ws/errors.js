'use strict';

const { defaultTo } = require('lodash/fp');
const { SERVICE_UNAVAILABLE } = require('http-status');

const { mac2id } = require('../util');

class InvalidMessageError extends Error {
  constructor(message = 'Invalid message') {
    super(message);
  }
}

class DecryptionFailedError extends Error {
  constructor(macAddress, remoteAddress, deviceId = mac2id(macAddress)) {
    super(`Decryption failed for device ${macAddress} (${deviceId}) from ${remoteAddress}`);
    this.mac = macAddress;
    this.deviceId = deviceId;
    this.remoteAddress = remoteAddress;
  }
}

class MessageParsingFailedError extends Error {
  constructor(payload, message = 'Unknown reason') {
    super(`Message parsing failed: ${message}`);
    this.payload = payload;
  }
}

class ConnectionClosedError extends Error {
  constructor(messageName) {
    super(`Cannot send '${messageName}' connection already closed`);
  }
}

class RpcTimeoutError extends Error {
  constructor(messageId, messageName) {
    super(`RPC request timeouted: ${messageId} ${messageName}`);
    this.messageId = messageId;
  }
}

class RpcError extends Error {
  constructor(message) {
    super(`RPC request error: ${message.id} ${message.name} (${defaultTo(0, message.errorCode)}) ${message.error}`);
    this.error = message.error;
    this.errorCode = message.errorCode;
  }
}

class ServerUnavailableError extends Error {
  constructor(message = 'Server unavailable', status = null) {
    super(message);
    this.status = status;
    this.statusCode = SERVICE_UNAVAILABLE;
  }
}

module.exports = {
  DecryptionFailedError,
  MessageParsingFailedError,
  ConnectionClosedError,
  InvalidMessageError,
  RpcTimeoutError,
  RpcError,
  ServerUnavailableError,
};
