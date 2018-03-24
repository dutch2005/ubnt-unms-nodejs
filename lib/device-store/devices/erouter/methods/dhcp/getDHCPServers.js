'use strict';

const { Observable } = require('rxjs/Rx');
const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwDhcpServers, fromHwRuntimeDhcpServers } = require('../../../../../transformers/device/erouter/index');
const { mergeDhcpServers } = require('../../../../../transformers/device/erouter/mergers');
const { merge: mergeM } = require('../../../../../transformers/index');

const configDHCPServersRequest = partial(rpcRequest, [
  { GET: { service: { 'dhcp-server': { 'shared-network-name': null } } } },
  'getConfigDHCPServers',
]);

const runtimeDHCPServersRequest = partial(rpcRequest, [
  { GETDATA: 'dhcp_stats' },
  'getRuntimeDHCPServers',
]);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function getDHCPServers() {
  const configDHCPServers$ = this.connection.rpc(configDHCPServersRequest())
    .map(pathOr({}, ['data', 'GET', 'service', 'dhcp-server', 'shared-network-name']));
  const runtimeDHCPServers$ = this.connection.rpc(runtimeDHCPServersRequest())
    .map(pathOr({}, ['data', 'output', 'dhcp-server-stats']));

  return Observable.forkJoin(configDHCPServers$, runtimeDHCPServers$)
    .mergeEither(([hwConfigDhcpServers, hwRuntimeDhcpServers]) => {
      const runtimeDhcpServers = fromHwRuntimeDhcpServers(hwRuntimeDhcpServers);
      const dhcpServers = fromHwDhcpServers(hwConfigDhcpServers);

      return dhcpServers.chain(mergeM(mergeDhcpServers, runtimeDhcpServers));
    });
}

module.exports = constant(getDHCPServers);

