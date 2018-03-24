'use strict';

const {
  pathOr, pathSatisfies, and, converge, ifElse, allPass, path, filter, propEq, test, defaultTo, match, merge,
  equals, anyPass, curry, head, omit, assocPath, when, isEmpty, view, lensIndex,
} = require('ramda');
const {
  flow, toPairs, map, pick, getOr, constant, concat, set, flatten, partition, split, get, nth, negate,
} = require('lodash/fp');
const { isNotNull, isUndefined, isNilOrEmpty, stubNull } = require('ramda-adjunct');
const moment = require('moment-timezone');

const {
  OspfAreaTypeEnum, OspfAuthTypeEnum, RouteTypeEnum, DhcpLeaseTypeEnum,
  StaticRouteTypeEnum,
} = require('../../../enums');
const { liftParser } = require('../../index');
const { viewOr, isNotNil, isNotEqual } = require('../../../util');
const { ospfAreaIdLens, ospfAreaNetworksLens, ospfAreaAuthLens } = require('./utils');
const { parseInterfaceListIpAddressCidr } = require('../../interfaces/parsers');

/**
 * @typedef {object} CorrespondenceOspfArea
 * @prop {string} id
 * @prop {OspfAreaTypeEnum} type
 * @prop {OspfAuthTypeEnum} auth
 * @prop {!Array.<string>} networks description
 */

/**
 * @typedef {Object} RedistributeObject
 * @prop {bool} enabled
 * @prop {?number} metric
 */

/**
 * @typedef {Object} CorrespondenceOspfConfig
 * @prop {string} router
 * @prop {RedistributeObject} redistributeConnected
 * @prop {RedistributeObject} redistributeStatic
 * @prop {bool} redistributeDefaultRoute
 */

/**
 * @typedef {Object} CorrespondenceRoute
 * @prop {?enums.RouteTypeEnum} type
 * @prop {?string} destination Destination route prefix in format <networkIP>/<reservedBits>
 * @prop {?string} description User description
 * @prop {?number} distance Distance/Cost of the route
 * @prop {?boolean} enabled Is route enabled?
 * @prop {?enums.StaticRouteTypeEnum} staticType Static Route Type - Null for dynamic routes
 * @prop {?string} interface Interface label
 * @prop {?string} gateway Gateway IP Address
 * @prop {?boolean} fib Is in Forward Information Base?
 * @prop {?enums.RouteGatewayStatusEnum} gatewayStatus Is gateway reachable? - Not Implemented
 * @prop {?boolean} selected Is Route selected?
 */

/**
 * @typedef {Object} CorrespondenceDhcpDns
 * @prop {string} primary IP of primary DNS server
 * @prop {string} secondary IP of secondary DNS server
 */

/**
 * typedef {Object} CorrespondenceDhcpRange
 * @prop {string} start DHCP pool first available address
 * @prop {string} end DHCP pool last available address
 */

/**
 * @typedef {Object} CorrespondenceDhcpLease
 * @prop {?string} id Lease ID
 * @prop {string} ipAddress IP addressed - must be unique
 * @prop {string} macAddress MAC address - must be unique
 * @prop {enums.DhcpLeaseTypeEnum} type Type of DHCP lease
 * @prop {string} hostname Hostname
 * @prop {string} expiration Expires at
 * @prop {string} serverName Name of DHCP server
 */

 /**
 * @typedef {Object} CorrespondenceDhcpServer
 * @prop {string} name DHCP server name - must be unique!
 * @prop {?string} domain DHCP domain
 * @prop {boolean} enabled DHCP server status
 * @prop {string} subnet DHCP network address in format <networkIP>/<reservedBits>
 * @prop {number} leaseTime DHCP server lease time (lease duration)
 * @prop {string} router Default gateway IP address
 * @prop {!CorrespondenceDhcpDns} dns
 * @prop {!CorrespondenceDhcpRange} range
 * @prop {?string} unifiController UniFi controller IP address
 * @prop {?number} poolSize Total amount of IPs in range
 * @prop {?number} availableLeases Number of available IPs in range
 * @prop {?number} leased Number of used leases
 * @prop {!Array.<CorrspondenceDhcpLease>} staticLeases Static DHCP Leases
 */

// parseHwOspfAreaType :: Object -> String
const parseHwOspfAreaType = flow(
  pathOr({}, ['1', 'area-type']),
  toPairs,
  pathOr(OspfAreaTypeEnum.Default, ['0', '0'])
);

// parseHwOspfArea :: Array.<[ String, Object ]> -> CorrespondenceOspfArea
const parseHwOspfArea = hwOspfAreaPair => ({
  id: viewOr(null, ospfAreaIdLens, hwOspfAreaPair),
  networks: viewOr([], ospfAreaNetworksLens, hwOspfAreaPair),
  type: parseHwOspfAreaType(hwOspfAreaPair),
  auth: viewOr(OspfAuthTypeEnum.None, ospfAreaAuthLens, hwOspfAreaPair),
});

// parseHwOspfAreas :: (Object, Object) -> Array.<CorrespondenceOspfArea>
const parseHwOspfAreas = (auxiliaries, hwOspfAreas) => flow(
  toPairs,
  map(parseHwOspfArea)
)(hwOspfAreas);

// parseHwOspfConfig :: (Object, Object) -> CorrespondenceOspfConfig
const parseHwOspfConfig = (auxiliaries, hwOspfConfig) => ({
  router: pathOr(null, ['parameters', 'router-id'], hwOspfConfig),
  redistributeConnected: {
    enabled: pathSatisfies(isNotNil, ['redistribute', 'connected'], hwOspfConfig),
    metric: pathOr(null, ['redistribute', 'connected', 'metric'], hwOspfConfig),
  },
  redistributeStatic: {
    enabled: pathSatisfies(isNotNil, ['redistribute', 'static'], hwOspfConfig),
    metric: pathOr(null, ['redistribute', 'static', 'metric'], hwOspfConfig),
  },
  redistributeDefaultRoute: {
    enabled: pathSatisfies(converge(and, [isNotNil, isNotEqual('null')]), ['default-information'], hwOspfConfig),
  },
});

// parseApiOspfConfig :: (Object, Object) -> CorrespondenceOspfConfig
const parseApiOspfConfig = (auxiliaries, apiOspfConfig) =>
  pick(['router', 'redistributeConnected', 'redistributeStatic', 'redistributeDefaultRoute'], apiOspfConfig);

// parseApiOspfArea :: (Object, Object) -> CorrespondenceOspfArea
const parseApiOspfArea = (auxiliaries, apiOspfArea) => pick(['id', 'auth', 'type', 'networks'], apiOspfArea);

/**
 * Parse interface route(s) associated with single destination.
 *
 * @sig parseConfigInterfaceHwRoute :: {next-hop-interface: Object|null} -> CorrespondenceRoute[]
 * @function parseConfigInterfaceHwRoute
 * @param {Object} interfaceRoutes
 * @return {CorrespondenceRoute[]}
 */
const parseConfigInterfaceHwRoute = (interfaceRoutes) => {
  const relevant = getOr({}, ['next-hop-interface'], interfaceRoutes);

  return flow(
    toPairs,
    map(iRoutePairs => ({
      type: RouteTypeEnum.Static,
      destination: interfaceRoutes.destination,
      description: getOr(null, ['1', 'description'], iRoutePairs),
      distance: flow(
        getOr(null, ['1', 'distance']),
        ifElse(
          isNaN,
          constant(null),
          Number
        )
      )(iRoutePairs),
      enabled: pathSatisfies(allPass([isNotNull, isNotEqual("''")]), ['1', 'disable'], iRoutePairs),
      staticType: StaticRouteTypeEnum.Interface,
      interface: getOr(null, ['0'], iRoutePairs),
      gateway: null,
      fib: null,
      gatewayStatus: null,
      selected: null,
    }))
  )(relevant);
};

/**
 * Parse gateway route(s)
 *
 * @sig parseConfigGatewayHwRoute :: [String, Object] -> CorrespondenceRoute[]
 * @function parseConfigGatewayHwRoute
 * @param {Array} relSubPair
 * @return {Array.<CorrespondenceRoute>}
 */
const parseConfigGatewayHwRoute = (relSubPair) => {
  const nhPairs = toPairs(path(['1'], relSubPair));

  return nhPairs.map(nhPair => ({
    type: RouteTypeEnum.Static,
    description: getOr(null, ['1', 'description'], nhPair),
    distance: flow(
      getOr(null, ['1', 'distance']),
      ifElse(
        isNaN,
        constant(null),
        Number
      )
    )(nhPair),
    enabled: pathSatisfies(allPass([isNotNull, isNotEqual("''")]), ['1', 'disable'])(nhPair),
    gateway: getOr(null, ['0'], nhPair),
    staticType: StaticRouteTypeEnum.Gateway,
    interface: null,
    fib: null,
    gatewayStatus: null,
    selected: null,
  }));
};

/**
 * Parse blackhole route
 *
 * @sig parseConfigBlackholeHwRoute :: [String, Object] -> CorrespondenceRoute[]
 * @function parseConfigBlackholeHwRoute
 * @param {Array} relSubPair
 * @return {CorrespondenceRoute}
 */
const parseConfigBlackholeHwRoute = relSubPair => ({
  type: RouteTypeEnum.Static,
  description: getOr(null, ['1', 'description'], relSubPair),
  distance: flow(
    getOr(null, ['1', 'distance']),
      ifElse(
        isNaN,
        constant(null),
        Number
      )
  )(relSubPair),
  enabled: pathSatisfies(allPass([isNotNull, isNotEqual("''")]), ['1', 'disable'], relSubPair),
  gateway: null,
  staticType: StaticRouteTypeEnum.Blackhole,
  interface: null,
  fib: null,
  gatewayStatus: null,
  selected: null,
});

/**
 * Parse & expand single static route
 *
 * @sig parseConfigGatewayAndBlackholeHwRoute :: [String, Object] -> CorrespondenceRoute[]
 * @function parseConfigGatewayAndBlackholeHwRoute
 * @param {Array} routePair
 * @return {Array.<CorrespondenceRoute>}
 */
const parseConfigGatewayAndBlackholeHwRoute = (routePair) => {
  const subPairs = toPairs(getOr({}, ['1'], routePair));

  return converge(concat, [
    flow(
      filter(propEq('0', 'blackhole')),
      map(parseConfigBlackholeHwRoute),
      map(set('destination', path(['0'], routePair)))
    ),
    // parse gateway routes
    flow(
      filter(propEq('0', 'next-hop')),
      map(parseConfigGatewayHwRoute),
      flatten,
      map(set('destination', path(['0'], routePair)))
    ),
  ])(subPairs);
};

/**
 * Parse static interface routes
 *
 * @sig parseConfigInterfaceHwRoutes :: {interface-route: Object} -> CorrespondenceRoute[]
 * @function parseConfigInterfaceHwRoutes
 * @param {Object}
 * @return {Array.<CorrespondenceRoute>}
 */
const parseConfigInterfaceHwRoutes = flow(
  getOr({}, ['interface-route']),
  toPairs,
  map(flow(
    hwRoutePair => set('destination', hwRoutePair[0], hwRoutePair[1]),
    parseConfigInterfaceHwRoute,
    flatten
  )),
  flatten
);

/**
 * Parse static gateway & blackhole routes
 *
 * @sig parseConfigGatewayAndBlackholeHwRoutes :: {route: Object} -> CorrespondenceRoute[]
 * @function parseConfigGatewayAndBlackholeHwRoutes
 * @param {Object}
 * @return {Array.<CorrespondenceRoute>}
 */
const parseConfigGatewayAndBlackholeHwRoutes = flow(
  getOr({}, ['route']),
  toPairs,
  map(parseConfigGatewayAndBlackholeHwRoute),
  flatten
);

/**
 * Parse config static routes
 *
 * @sig parseConfigHwRoutes :: (Object, {routes: Object|null, interface-routes: Object|null}) -> CorrespondenceRoute[]
 * @function parseConfigHwRoutes
 * @param {Object} auxiliaries
 * @param {Object} configHwRoutes
 * @return {Array.<CorrespondenceRoute>}
 */
const parseConfigHwRoutes = (auxiliaries, configHwRoutes) => converge(concat, [
  parseConfigInterfaceHwRoutes,
  parseConfigGatewayAndBlackholeHwRoutes,
])(configHwRoutes);

/**
 * Group routes based on nesting
 *
 * @sig partitionAllHwRoutes :: {nh: Array} -> CorrespondenceRoute[]
 * @function partitionAllHwRoutes
 * @param {Object} route
 * @return {Array.<CorrespondenceRoute>}
 */
const partitionAllHwRoutes = partition(route => pathOr(0, ['nh', 'length'], route) > 1);

/**
 * Expand nested routes to route[]
 *
 * @sig expandAllHwRoutesMapper :: {nh: Array, pfx: string} -> Array
 * @function expandAllHwRoutesMapper
 * @param {Object} route
 * @return {Array}
 */
const expandAllHwRoutesMapper = route => route.nh.map(nextHopItem => ({
  pfx: route.pfx,
  nh: [nextHopItem],
}));

/**
 * Expand nested routes to route[]
 *
 * @sig expandAllHwRoutes :: Array -> Array
 * @function expandAllHwRoutes
 * @param {Array} allHwRoutes
 * @return {Array}
 */
const expandAllHwRoutes = (allHwRoutes) => {
  const partitionedAllHwRoutes = partitionAllHwRoutes(allHwRoutes);

  return converge(concat, [
    getOr([], ['1']),
    flow(getOr([], ['0']), map(expandAllHwRoutesMapper), flatten),
  ])(partitionedAllHwRoutes);
};

/**
 * Parse single route type
 *
 * @sig parseAllHwRouteProps :: Object -> Object
 * @function parseAllHwRouteProps
 * @param {Object} allHwRoute
 * @return {Object}
 */
const parseAllHwRouteProps = (allHwRoute) => {
  const rawType = getOr(null, ['nh', '0', 't'], allHwRoute);
  return {
    type: pathOr(null, [0], rawType),
    selected: test(/>/, rawType),
    fib: test(/\*/, rawType),
  };
};

/**
 * Extract route distance
 *
 * @sig parseAllHwRouteDistance :: Object -> String
 * @function parseAllHwRouteDistance
 * @param {Object}
 * @return {string}
 */
const parseAllHwRouteDistance = flow(
  getOr('', ['nh', '0', 'metric']),
  split('/'),
  getOr(1, ['0']),
  Number
);

/**
 * Map single AllRoute to correspondence format
 *
 * @sig parseAllHwRoute :: Object -> CorrespondenceRoute
 * @function parseAllHwRoute
 * @param {Object} allHwRoute
 * @return {CorrespondenceRoute}
 */
const parseAllHwRoute = (allHwRoute) => {
  const allHwRouteProps = parseAllHwRouteProps(allHwRoute);

  return {
    type: get('type', allHwRouteProps),
    destination: getOr(null, ['pfx'], allHwRoute),
    description: null,
    distance: parseAllHwRouteDistance(allHwRoute),
    enabled: true,
    staticType: null,
    interface: getOr(null, ['nh', '0', 'intf'], allHwRoute),
    gateway: getOr(null, ['nh', '0', 'via'], allHwRoute),
    fib: get('fib', allHwRouteProps),
    gatewayStatus: null,
    selected: get('selected', allHwRouteProps),
  };
};

/**
 * Parse dynamic hardware routes
 *
 * @sig parseAllHwRoutes :: (Object, Array) -> CorrespondenceRoute[]
 * @function parseAllHwRoutes
 * @param {Object} auxiliaries
 * @param {Object} allHwRoutes
 * @return {Array.<CorrespondenceRoute>}
 */
const parseAllHwRoutes = (auxiliaries, allHwRoutes) => flow(
    expandAllHwRoutes,
    map(parseAllHwRoute)
)(allHwRoutes);

/**
 * Parse API route
 *
 * @sig parseApiRoute :: (Object, Object) -> CorrespondenceRoute
 * @function parseApiRoute
 * @param {Object} auxiliaries
 * @param {Object} apiRoute
 * @return {!CorrespondenceRoute}
 */
const parseApiRoute = (auxiliaries, apiRoute) => ({
  type: defaultTo(RouteTypeEnum.Static, apiRoute.type),
  enabled: defaultTo(true, apiRoute.enabled),
  staticType: apiRoute.staticType,
  destination: apiRoute.destination,
  interface: defaultTo(null, apiRoute.interface),
  gateway: defaultTo(null, apiRoute.gateway),
  distance: apiRoute.distance,
  description: defaultTo(null, apiRoute.description),
  gatewayStatus: null,
  selected: null,
  fib: null,
});

// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = flow(match(/ER-(e\d+)\./), nth(1), defaultTo(null));

// parseHwDeviceName :: HwStatus -> DeviceName
//     HwStatus = Object
//     DeviceName = String
const parseHwDeviceName = getOr('ubnt', ['system', 'host-name']);

// parseHwGateway :: HwStatus -> Gateway
//     HwStatus = Object
//     Gateway = String
const parseHwGateway = getOr(null, ['system', 'gateway-address']);

// parseDhcpRange :: Object -> Object
const parseDhcpRange = flow(
  toPairs,
  head, // should contain only one pair
  ([start, rest] = []) => ({
    start: defaultTo(null, start),
    end: pathOr(null, ['stop'], rest),
  })
);

const parseDHCPStaticLease = curry((serverName, hwLeasePair) => ({
  id: hwLeasePair[0],
  ipAddress: path([1, 'ip-address'], hwLeasePair),
  macAddress: path([1, 'mac-address'], hwLeasePair),
  type: DhcpLeaseTypeEnum.Static,
  hostname: null,
  expiration: null,
  serverName,
}));

const parseDHCPStaticLeases = (serverName, hwStaticLeases) => flow(
  toPairs,
  ifElse(
    isNilOrEmpty,
    constant([]),
    map(parseDHCPStaticLease(serverName)))
)(hwStaticLeases);

const parseKnownSubnetParams = curry((serverName, [subnet, rest]) => ({
  subnet,
  router: pathOr(null, ['default-router'], rest),
  dns: {
    primary: pathOr(null, ['dns-server', 0], rest),
    secondary: pathOr(null, ['dns-server', 1], rest),
  },
  domain: pathOr(null, ['domain-name'], rest),
  leaseTime: pathOr(null, ['lease'], rest),
  range: parseDhcpRange(path(['start'], rest)),
  unifiController: pathOr(null, ['unifi-controller'], rest),
  staticLeases: parseDHCPStaticLeases(serverName, pathOr(null, ['static-mapping'], rest)),
}));

// parseDhcpSubnet :: Object -> Object
const parseDhcpSubnet = (serverName, hwDHCPSubnet) => flow(
  toPairs,
  head, // should contain only one pair
  converge(assocPath(['subnetParams']), [
    flow(
      view(lensIndex(1)),
      // omit used by design - we want all CLI options that have not been explicitly parsed by
      // `parseKnownSubnetParams` function, so we do not loose CLI configuration
      // on DHCP server update from UNMS.
      omit(['default-router', 'dns-server', 'domain-name', 'lease', 'start', 'unifi-controller', 'static-mapping']),
      when(isEmpty, stubNull)
    ),
    parseKnownSubnetParams(serverName),
  ])
)(hwDHCPSubnet);

// parseHwDhcpServer :: Object -> CorrespondenceDhcpServer
//    CorrespondenceDhcpServer  = Object
const parseHwDhcpServer = converge(merge, [
  hwDhcpPair => ({
    name: path([0], hwDhcpPair),
    enabled: isUndefined(path([1, 'disable'], hwDhcpPair)),
    description: pathOr(null, [1, 'description'], hwDhcpPair),
    sharedNetworkParameters: pathOr(null, [1, 'shared-network-parameters'], hwDhcpPair),
    authoritative: pathOr(null, [1, 'authoritative'], hwDhcpPair),
    poolSize: null,
    availableLeases: null,
    leased: null,
  }),
  hwDhcpPair => parseDhcpSubnet(hwDhcpPair[0], path([1, 'subnet'], hwDhcpPair)),
]);

// parseHwDhcpServers :: (Auxiliaries, Object) -> CorrespondenceDhcpServer[]
//    Auxiliaries               = Object
//    CorrespondenceDhcpServer  = Object
const parseHwDhcpServers = (auxiliaries, hwDhcpServers) => ifElse(
  anyPass([isNilOrEmpty, equals('null')]),
  constant([]),
  flow(
    toPairs,
    map(parseHwDhcpServer)
  )
)(hwDhcpServers);

// parseRuntimeHwDhcpServer :: Obejct -> Object
const parseRuntimeHwDhcpServer = hwRuntimeDhcpPair => ({
  name: path([0], hwRuntimeDhcpPair),
  availableLeases: path([1, 'available'], hwRuntimeDhcpPair),
  poolSize: path([1, 'pool_size'], hwRuntimeDhcpPair),
  leased: path([1, 'leased'], hwRuntimeDhcpPair),
});

// parseRuntimeHwDhcpServerList :: (Object, Object) -> Array.<Obejct>
const parseRuntimeHwDhcpServerList = (auxiliaries, hwRuntimeDhcp) => ifElse(
  anyPass([isNilOrEmpty, equals('null')]),
  constant([]),
  flow(
    toPairs,
    map(parseRuntimeHwDhcpServer)
  )
)(hwRuntimeDhcp);

// parseApiDhcpServer (Auxiliaries, ApiDhcpServer) -> CorrespondenceDhcpServer
//    AuxAuxiliaries            = Object
//    ApiDhcpServer             = Object
//    CorrespondenceDhcpServer  = Object
const parseApiDhcpServer = (auxiliaries, apiDhcpServer) => ({
  name: path(['name'], apiDhcpServer),
  enabled: pathOr(true, ['enabled'], apiDhcpServer),
  dns: {
    primary: pathOr(null, ['dns1'], apiDhcpServer),
    secondary: pathOr(null, ['dns2'], apiDhcpServer),
  },
  router: path(['router'], apiDhcpServer),
  subnet: path(['interface'], apiDhcpServer),
  leaseTime: path(['leaseTime'], apiDhcpServer),
  range: {
    start: path(['rangeStart'], apiDhcpServer),
    end: path(['rangeEnd'], apiDhcpServer),
  },
  domain: pathOr(null, ['domain'], apiDhcpServer),
  unifiController: pathOr(null, ['unifiController'], apiDhcpServer),
  available: null,
  poolSize: null,
  leased: null,
});

// parseHwDynamicDHCPLease :: String -> Array -> Object
const parseHwDynamicDHCPLease = curry((serverName, hwLeasePair) => ({
  hostname: pathOr(null, [1, 'client-hostname'], hwLeasePair),
  expiration: moment(hwLeasePair[1].expiration, 'YYYY/MM/DD HH:mm:ss'),
  macAddress: hwLeasePair[1].mac,
  ipAddress: hwLeasePair[0],
  id: null,
  type: DhcpLeaseTypeEnum.Dynamic,
  serverName,
}));

// parseDhcpLeasesServerList :: Array -> Array
const parseDhcpLeasesServerList = ([serverName, hwLease]) => flow(
  toPairs,
  map(parseHwDynamicDHCPLease(serverName))
)(hwLease);

// parseHwDynamicDHCPLeasesList :: (Auxiliaries, HwDynamicLeases) -> CorrespondenceDhcpLease[]
//    Auxiliaries              = Object
//    HwDynamicLeases          = Object
//    CorrespondenceDhcpLease  = Object
const parseHwDynamicDHCPLeasesList = (auxiliaries, hwDynamicLeases) => ifElse(
  anyPass([isNilOrEmpty, equals('null')]),
  constant([]),
  flow(
    toPairs,
    filter(pathSatisfies(negate(isNilOrEmpty), [1])),
    map(parseDhcpLeasesServerList),
    flatten
  )
)(hwDynamicLeases);

// parseApiDHCPLease :: (Object, Object) -> CorrespondenceDhcpLease
const parseApiDHCPLease = (auxiliaries, apiDhcpLease) => ({
  id: apiDhcpLease.leaseId,
  ipAddress: apiDhcpLease.address,
  macAddress: apiDhcpLease.mac,
  serverName: apiDhcpLease.serverName,
  type: DhcpLeaseTypeEnum.Static,
  hostname: null,
  expiration: null,
});

// parseApiSystem :: (Object, Object) -> CorrespondenceDhcpLease
const parseApiSystem = (auxiliaries, apiSystem) => ({
  name: apiSystem.name,
  timezone: apiSystem.timezone,
  gateway: apiSystem.gateway,
  domainName: apiSystem.domainName,
  dns1: apiSystem.dns1,
  dns2: apiSystem.dns2,
  admin: {
    login: {
      username: getOr(null, 'username', apiSystem.admin.login),
      password: getOr(null, 'password', apiSystem.admin.login),
    },
  },
  readOnlyAccount: {
    enabled: apiSystem.readOnlyAccount.enabled,
    login: {
      username: getOr(null, 'username', apiSystem.readOnlyAccount.login),
      password: getOr(null, 'password', apiSystem.readOnlyAccount.login),
    },
  },
});

// TODO(michal.sedlak@ubnt.com): Make parse more explicit
// parseApiServices :: (Object, Object) -> CorrespondenceServices
const parseApiServices = (auxiliaries, apiServices) => ({
  ntpClient: apiServices.ntpClient,
  systemLog: apiServices.systemLog,
  telnetServer: apiServices.telnetServer,
  snmpAgent: apiServices.snmpAgent,
  sshServer: apiServices.sshServer,
  webServer: apiServices.webServer,
  discovery: apiServices.discovery,
});

// parseErouterIpAddress :: Auxiliaries -> CorrespondenceData -> IpAddress
//    Auxiliaries        = Object
//    CorrespondenceData = Object
//    IpAddress          = String
const parseErouterIpAddress = curry((auxiliaries, erouter) =>
  parseInterfaceListIpAddressCidr({ gateway: getOr(null, ['overview', 'gateway'], erouter) }, erouter.interfaces)
);

module.exports = {
  parseHwOspfAreas,
  parseHwOspfConfig,
  parseApiOspfConfig,
  parseApiOspfArea,
  parseConfigHwRoutes,
  parseAllHwRoutes,
  parseApiRoute,
  parsePlatformId,
  parseHwDeviceName,
  parseHwGateway,
  parseHwDhcpServers,
  parseApiDhcpServer,
  parseRuntimeHwDhcpServerList,
  parseHwDynamicDHCPLeasesList,
  parseApiDHCPLease,
  parseApiSystem,
  parseApiServices,
  parseErouterIpAddress,

  safeParseHwOspfAreas: liftParser(parseHwOspfAreas),
  safeParseHwOspfConfig: liftParser(parseHwOspfConfig),
  safeParseApiOspfConfig: liftParser(parseApiOspfConfig),
  safeParseApiOspfArea: liftParser(parseApiOspfArea),
  safeParseConfigHwRoutes: liftParser(parseConfigHwRoutes),
  safeParseAllHwRoutes: liftParser(parseAllHwRoutes),
  safeParseApiRoute: liftParser(parseApiRoute),
  safeParseHwDhcpServers: liftParser(parseHwDhcpServers),
  safeParseApiDhcpServer: liftParser(parseApiDhcpServer),
  safeParseRuntimeHwDhcpServerList: liftParser(parseRuntimeHwDhcpServerList),
  safeParseHwDynamicDHCPLeasesList: liftParser(parseHwDynamicDHCPLeasesList),
  safeParseApiDHCPLease: liftParser(parseApiDHCPLease),
  safeParseApiSystem: liftParser(parseApiSystem),
  safeParseApiServices: liftParser(parseApiServices),
  safeParseErouterIpAddress: liftParser(parseErouterIpAddress),
};
