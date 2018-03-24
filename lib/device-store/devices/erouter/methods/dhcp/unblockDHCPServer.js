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
function unblockDHCPServer(correspondenceDhcpServer) {
  const deleteData = assocPath(
    ['service', 'dhcp-server', 'shared-network-name', correspondenceDhcpServer.name],
    { disable: "''" },
    {}
  );

  return this.connection.rpc(setConfigRequest(null, deleteData));
}

module.exports = constant(unblockDHCPServer);

