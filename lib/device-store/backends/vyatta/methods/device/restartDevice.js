'use strict';

const { constant, partial } = require('lodash/fp');

const { rpcRequest } = require('../../../ubridge/messages');

const restartDeviceRequest = partial(rpcRequest, [{ OPERATION: { op: 'reboot' } }, 'restart']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function restartDevice() {
  return this.connection.send(restartDeviceRequest());
}

module.exports = constant(restartDevice);
