'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} correspondenceDhcpServer
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function blockDHCPServer(correspondenceDhcpServer) {
  const setData = assocPath(
    ['service', 'dhcp-server', 'shared-network-name', correspondenceDhcpServer.name],
    { disable: "''" },
    {}
  );

  return this.connection.rpc(setConfigRequest(setData, null));
}

module.exports = constant(blockDHCPServer);

