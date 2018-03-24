'use strict';

const { pick, pathOr, path, when } = require('ramda');
const { map, invoke, getOr, defaultTo } = require('lodash/fp');

const { liftMapper } = require('../../index');
const { isMomentOrDate } = require('../../../util');

const toApiOspfAreasList = map(
  pick(['id', 'type', 'auth', 'networks'])
);

const toApiOspfConfig = pick(['router', 'redistributeDefaultRoute', 'redistributeConnected', 'redistributeStatic']);

/**
 * Transform Single Correspondence route to API
 *
 * @sig toApiRoute :: CorrespondenceRoute -> Object
 * @function toApiRoute
 * @param {CorrespondenceRoute} correspondenceRoute
 * @return {Object} apiRoute
 */
const toApiRoute = correspondenceRoute => ({
  description: pathOr(null, ['description'], correspondenceRoute),
  destination: pathOr(null, ['destination'], correspondenceRoute),
  distance: pathOr(null, ['distance'], correspondenceRoute),
  enabled: pathOr(null, ['enabled'], correspondenceRoute),
  fib: pathOr(null, ['fib'], correspondenceRoute),
  gateway: pathOr(null, ['gateway'], correspondenceRoute),
  gatewayStatus: pathOr(null, ['gatewayStatus'], correspondenceRoute),
  interface: pathOr(null, ['interface'], correspondenceRoute),
  nextHop: pathOr(null, ['nextHop'], correspondenceRoute),
  selected: pathOr(null, ['selected'], correspondenceRoute),
  type: pathOr(null, ['type'], correspondenceRoute),
  staticType: pathOr(null, ['staticType'], correspondenceRoute),
});

/**
 * Transform Correspondence routes to API format
 *
 * @sig toApiRouteList :: CorrespondenceRoute[] -> Object[]
 * @function toApiRouteList
 * @param {CorrespondenceRoute[]}
 * @return Object[]
 */
const toApiRouteList = map(toApiRoute);

/**
 * Transform single Dhcp Server to API format
 *
 * @sig toApiDhcpServer :: CorrespondenceDhcpServer -> Object
 * @param {CorrespondenceDhcpServer} correspondenceDhcpServer
 * @return {!Object} API DHCP server
 */
const toApiDhcpServer = correspondenceDhcpServer => ({
  available: correspondenceDhcpServer.availableLeases,
  leases: correspondenceDhcpServer.leased,
  dns1: path(['dns', 'primary'], correspondenceDhcpServer),
  dns2: path(['dns', 'secondary'], correspondenceDhcpServer),
  domain: correspondenceDhcpServer.domain,
  enabled: correspondenceDhcpServer.enabled,
  interface: correspondenceDhcpServer.subnet,
  leaseTime: correspondenceDhcpServer.leaseTime,
  name: correspondenceDhcpServer.name,
  poolSize: correspondenceDhcpServer.poolSize,
  rangeStart: correspondenceDhcpServer.range.start,
  rangeEnd: correspondenceDhcpServer.range.end,
  router: correspondenceDhcpServer.router,
  unifiController: correspondenceDhcpServer.unifiController,
});

/**
 * Transform Dhcp Server List to API format
 *defaultTo
 * @sig toApiDhcpServer :: CorrespondenceDhcpServer[] -> Object[]
 * @param {!CorrespondenceDhcpServer[]} correspondenceDhcpServer
 * @return {!Object[]} API DHCP server
 */
const toApiDhcpServerList = map(toApiDhcpServer);

/**
 * Transform DHCP Lease
 *
 * @param {!CorrespondenceDhcpLease} cmDHCPLease
 * @return {!Object}
 */
const toApiDHCPLease = cmDHCPLease => ({
  address: cmDHCPLease.ipAddress,
  expiration: when(isMomentOrDate, invoke('toISOString'), cmDHCPLease.expiration),
  hostname: cmDHCPLease.hostname,
  leaseId: cmDHCPLease.id,
  mac: cmDHCPLease.macAddress,
  serverName: cmDHCPLease.serverName,
  type: cmDHCPLease.type,
});

/**
 * Transform DHCP Leases to API format
 *
 * @sig toApiDHCPLeasesList :: CorrespondenceDhcpLease[] -> Object[]
 * @param {!CorrespondenceDhcpLease[]}
 * @return {!Object[]}
 */
const toApiDHCPLeasesList = map(toApiDHCPLease);

/**
 * @param {CorrespondenceVyattaSystem} cmSystem
 * @return {Object}
 */
const toApiSystem = cmSystem => ({
  name: cmSystem.name,
  timezone: cmSystem.timezone,
  timezoneList: defaultTo([], cmSystem.timezoneList),
  gateway: cmSystem.gateway,
  domainName: cmSystem.domainName,
  dns1: cmSystem.dns1,
  dns2: cmSystem.dns2,
  admin: {
    login: {
      username: getOr(null, 'username', cmSystem.admin.login),
    },
  },
  readOnlyAccount: {
    enabled: cmSystem.readOnlyAccount.enabled,
    login: {
      username: getOr(null, 'username', cmSystem.readOnlyAccount.login),
    },
  },
});

// TODO(michal.sedlak@ubnt.com): Make mapper more explicit
/**
 * @param {CorrespondenceServices} cmServices
 * @return {Object}
 */
const toApiServices = cmServices => ({
  ntpClient: cmServices.ntpClient,
  systemLog: cmServices.systemLog,
  telnetServer: cmServices.telnetServer,
  snmpAgent: cmServices.snmpAgent,
  sshServer: cmServices.sshServer,
  webServer: cmServices.webServer,
  discovery: cmServices.discovery,
});

module.exports = {
  toApiOspfAreasList,
  toApiOspfConfig,
  toApiRoute,
  toApiRouteList,
  toApiDhcpServer,
  toApiDhcpServerList,
  toApiDHCPLeasesList,
  toApiSystem,
  toApiServices,

  safeToApiOspfAreasList: liftMapper(toApiOspfAreasList),
  safeToApiOspfConfig: liftMapper(toApiOspfConfig),
  safeToApiRoute: liftMapper(toApiRoute),
  safeToApiRouteList: liftMapper(toApiRouteList),
  safeToApiDhcpServer: liftMapper(toApiDhcpServer),
  safeToApiDhcpServerList: liftMapper(toApiDhcpServerList),
  safeToApiDHCPLeasesList: liftMapper(toApiDHCPLeasesList),
  safeToApiSystem: liftMapper(toApiSystem),
  safeToApiServices: liftMapper(toApiServices),
};
