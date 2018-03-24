'use strict';

const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwDHCPLeasesList } = require('../../../../../transformers/device/erouter/index');

const dhcpLeasesRequest = partial(rpcRequest, [{ GETDATA: 'dhcp_leases' }, 'getDHCPLeases']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getDHCPLeases() {
  return this.connection.rpc(dhcpLeasesRequest())
    .map(pathOr({}, ['data', 'output', 'dhcp-server-leases']))
    .mergeEither(fromHwDHCPLeasesList);
}

module.exports = constant(getDHCPLeases);

