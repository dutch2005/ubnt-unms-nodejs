'use strict';

const { defaultTo, getOr } = require('lodash/fp');

class NotImplementedError extends Error {
  constructor(message = 'Not implemented') {
    super(message);
  }
}

class UnknownDeviceError extends Error {
  constructor(model, message = `Device recognition failed for '${model}'.`) {
    super(message);
    this.model = model;
  }
}

class InvalidOperationError extends Error {
  constructor(message = 'Operation is invalid') {
    super(message);
  }
}

class DeviceNotFoundError extends Error {
  constructor(message = 'Device not found') {
    super(message);
  }
}

class DeviceInvalidError extends Error {
  constructor(message = 'Device setup has failed') {
    super(message);
  }
}

/**
 * Error thrown when shell command on device return non zero status.
 */
class CommandError extends Error {
  constructor(result) {
    // extract error message
    super(getOr('Command has failed', ['data', 'output', '0'], result));

    this.data = defaultTo({}, result.data);
  }
}

module.exports = {
  NotImplementedError,
  UnknownDeviceError,
  InvalidOperationError,
  DeviceNotFoundError,
  DeviceInvalidError,
  CommandError,
};
