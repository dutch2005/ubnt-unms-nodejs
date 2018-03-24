'use strict';

const { constant, flow, map, fromPairs, merge } = require('lodash/fp');
const { allPass, assocPath, pathSatisfies, path } = require('ramda');
const { isNotNull, isNotNil, isNotEmpty } = require('ramda-adjunct');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDhcpServer} correspondenceDhcpServer
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function upsertDHCPServer(correspondenceDhcpServer) {
  const basePath = ['service', 'dhcp-server', 'shared-network-name', correspondenceDhcpServer.name];

  // base dhcp server hw instructions
  let setData = assocPath(basePath, {
    subnet: {
      [correspondenceDhcpServer.subnet]: {
        lease: correspondenceDhcpServer.leaseTime,
        start: {
          [correspondenceDhcpServer.range.start]: {
            stop: correspondenceDhcpServer.range.end,
          },
        },
      },
    },
  }, {});

  // authoritative hw instructions
  if (pathSatisfies(isNotNull, ['authoritative'], correspondenceDhcpServer)) {
    setData = assocPath([...basePath, 'authoritative'], correspondenceDhcpServer.authoritative, setData);
  }

  // description hw instructions
  if (pathSatisfies(isNotNull, ['description'], correspondenceDhcpServer)) {
    setData = assocPath([...basePath, 'description'], correspondenceDhcpServer.description, setData);
  }

  // description hw instructions
  if (pathSatisfies(isNotNull, ['sharedNetworkParameters'], correspondenceDhcpServer)) {
    setData = assocPath(
      [...basePath, 'shared-network-parameters'],
      correspondenceDhcpServer.sharedNetworkParameters,
      setData
    );
  }

  // is dhcp server disabled hw instructions
  if (!correspondenceDhcpServer.enabled) {
    setData = assocPath([...basePath, 'disable'], "''", setData);
  }

  // default subnet settings hw instruction
  if (pathSatisfies(isNotNull, ['subnetParams'], correspondenceDhcpServer)) {
    const persistData = assocPath(
      [...basePath, 'subnet', correspondenceDhcpServer.subnet],
      correspondenceDhcpServer.subnetParams,
      {}
    );

    setData = merge(setData, persistData);
  }

  // default gateway hw instructions
  if (pathSatisfies(isNotNull, ['router'], correspondenceDhcpServer)) {
    setData = assocPath(
      [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'default-router'],
      correspondenceDhcpServer.router,
      setData
    );
  }

  // dns 1 hw instructions
  if (pathSatisfies(isNotNull, ['dns', 'primary'], correspondenceDhcpServer)) {
    setData = assocPath(
      [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'dns-server'],
      [correspondenceDhcpServer.dns.primary],
      setData
    );
  }

  // dns 2 hw instructions
  if (pathSatisfies(isNotNull, ['dns', 'secondary'], correspondenceDhcpServer)) {
    if (pathSatisfies(isNotNull, ['dns', 'primary'], correspondenceDhcpServer)) {
      setData = assocPath(
        [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'dns-server'],
        [correspondenceDhcpServer.dns.primary, correspondenceDhcpServer.dns.secondary],
        setData
      );
    } else {
      setData = assocPath(
        [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'dns-server'],
        [correspondenceDhcpServer.dns.secondary],
        setData
      );
    }
  }

  // unifi controller hw instructions
  if (pathSatisfies(isNotNull, ['unifiController'], correspondenceDhcpServer)) {
    setData = assocPath(
      [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'unifi-controller'],
      correspondenceDhcpServer.unifiController,
      setData
    );
  }

  // domain hw instructions
  if (pathSatisfies(isNotNull, ['domain'], correspondenceDhcpServer)) {
    setData = assocPath(
      [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'domain-name'],
      correspondenceDhcpServer.domain,
      setData
    );
  }

  // static dhcp leases (IP reservations) HW instructions
  if (pathSatisfies(allPass([isNotNil, isNotEmpty]), ['staticLeases'], correspondenceDhcpServer)) {
    const staticLeases = flow(
      path(['staticLeases']),
      map(
        lease => ([lease.id, { 'ip-address': lease.ipAddress, 'mac-address': lease.macAddress }])
      ),
      fromPairs
    )(correspondenceDhcpServer);

    setData = assocPath(
      [...basePath, 'subnet', correspondenceDhcpServer.subnet, 'static-mapping'],
      staticLeases,
      setData
    );
  }

  const deleteData = assocPath([...basePath], "''", {});

  return this.connection.rpc(setConfigRequest(setData, deleteData));
}

module.exports = constant(upsertDHCPServer);

