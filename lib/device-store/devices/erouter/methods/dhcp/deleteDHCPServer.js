'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} name
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function deleteDHCPServer(name) {
  const deleteData = assocPath(['service', 'dhcp-server', 'shared-network-name', name], "''", {});

  return this.connection.rpc(setConfigRequest(null, deleteData));
}

module.exports = constant(deleteDHCPServer);

