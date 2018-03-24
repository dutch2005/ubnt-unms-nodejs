'use strict';

const { constant } = require('lodash/fp');

const { rpcRequest } = require('../../../../backends/ubridge/messages');

/**
 * Restarts onu thought parent OLT.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {number} onuId - This is not UNMS ONU ID(UUID), but rather hw prop managed by OLT.
 * @param {number} oltPort
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function restartOnu(onuId, oltPort) {
  return this.connection.rpc(rpcRequest({ REBOOT_ONU: { onu_id: onuId, olt_port: oltPort } }, 'restartOnu'));
}

module.exports = constant(restartOnu);

