'use strict';

const { constant, partial } = require('lodash/fp');

const { commandRequest } = require('../../../../backends/ubridge/messages');

const restartDeviceRequest = partial(commandRequest, ['reboot']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<void>}
 */
function restartDevice() {
  return this.connection.send(restartDeviceRequest());
}

module.exports = constant(restartDevice);
