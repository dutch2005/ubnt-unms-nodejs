'use strict';

const { constant, partial, __ } = require('lodash/fp');

const { rpcRequest } = require('../../../../backends/ubridge/messages');

const upgradeOnuRequest = partial(rpcRequest, [__, 'upgradeOnu']);

/**
 * Upgrades potentially multiple onus on one OLT.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} onuSerial
 * @param {number} oltPort
 * @param {string} firmwareUrl
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function upgradeOnu(onuSerial, oltPort, firmwareUrl) {
  return this.connection.rpc(upgradeOnuRequest({
    UPGRADE_ONU: { onu_list: [{ olt_port: oltPort, serial: onuSerial }], url: firmwareUrl },
  }));
}

module.exports = constant(upgradeOnu);

