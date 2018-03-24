'use strict';

const { constant, partial } = require('lodash/fp');

const { rpcRequest } = require('../../../ubridge/messages');

const resetInterfaceStatsRequest = partial(rpcRequest, [
  { OPERATION: { op: 'clear-traffic-analysis' } },
  'resetInterfaceStats',
]);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function resetInterfaceStats() {
  return this.connection.rpc(resetInterfaceStatsRequest());
}

module.exports = constant(resetInterfaceStats);
