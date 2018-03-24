'use strict';

const { pathSatisfies, pathEq, when, pathOr, head, find, minBy } = require('ramda');
const {
  flow, pick, isNull, map, getOr, get, reduce, isNil, defaultTo, isString, eq, filter, curry, flatMap,
} = require('lodash/fp');
const ip = require('ip');
const { stubNull, isNotPlainObject, isNotArray } = require('ramda-adjunct');

const { liftParser } = require('../index');
const { cidrToIp } = require('../../util');
const { InterfaceIdentificationTypeEnum, InterfaceSpeedEnum } = require('../../enums');

/*
 * DB parsing
 */

// parseDbInterfacePoe :: Auxiliaries, Object
//     Auxiliaries = Object
const parseDbInterfacePoe = dbInterface => ({
  output: getOr(null, ['poe', 'output'], dbInterface),
  capacities: getOr([], ['poe', 'capacities'], dbInterface),
});

// parseDbInterfaceSpeed :: Object -> Speed
//     Speed = String
const parseDbInterfaceSpeed = (dbInterface) => {
  if (isNil(dbInterface.status)) { return null }

  const { speed, duplex } = dbInterface.status;

  if (speed === 'auto') {
    return InterfaceSpeedEnum.Auto;
  } else if (isNull(speed)) {
    return null;
  } else if (isNull(duplex)) {
    return String(speed);
  }
  return `${speed}-${duplex ? 'full' : 'half'}`;
};

// parseDbInterfaceStatusDescription :: Object -> SpeedDescription
//     SpeedDescription = String
const parseDbInterfaceStatusDescription = (dbInterface) => {
  if (isNil(dbInterface.status)) { return null }

  const { speed, duplex } = dbInterface.status;

  if (speed === 'auto') {
    return 'Auto negotiation';
  } else if (isNull(speed)) {
    return null;
  } else if (isNull(duplex)) {
    return `${speed} Mbps`;
  }
  return `${speed} Mbps - ${duplex ? 'Full Duplex' : 'Half Duplex'}`;
};

const parseInterfaceIdentification = (dbInterfaceIdentification = {}) => ({
  position: defaultTo(null, dbInterfaceIdentification.position),
  type: defaultTo(null, dbInterfaceIdentification.type),
  name: defaultTo(null, dbInterfaceIdentification.name),
  description: defaultTo(null, dbInterfaceIdentification.description),
  mac: defaultTo(null, dbInterfaceIdentification.mac),
});

const parseDbInterfaceSwitchPorts = flow(
  defaultTo([]),
  map(port => ({
    interface: parseInterfaceIdentification(port.interface),
    enabled: getOr(false, ['enabled'], port),
    pvid: getOr(null, ['pvid'], port),
    vid: getOr([], ['vid'], port),
  }))
);

const parseDbInterfaceBridgePorts = flow(
  defaultTo([]),
  map(port => ({
    interface: parseInterfaceIdentification(port.interface),
    enabled: getOr(false, ['enabled'], port),
  }))
);

// parseDbInterfaceStatistics :: Object -> Object
const parseDbInterfaceStatistics = dbInterface => ({
  timestamp: getOr(0, ['statistics', 'timestamp'], dbInterface),
  rxrate: getOr(0, ['statistics', 'rxrate'], dbInterface),
  rxbytes: getOr(0, ['statistics', 'rxbytes'], dbInterface),
  txrate: getOr(0, ['statistics', 'txrate'], dbInterface),
  txbytes: getOr(0, ['statistics', 'txbytes'], dbInterface),
  dropped: getOr(0, ['statistics', 'dropped'], dbInterface),
  errors: getOr(0, ['statistics', 'errors'], dbInterface),
  previousTxbytes: getOr(0, ['statistics', 'previousTxbytes'], dbInterface),
  previousRxbytes: getOr(0, ['statistics', 'previousRxbytes'], dbInterface),
  previousDropped: getOr(0, ['statistics', 'previousDropped'], dbInterface),
  previousErrors: getOr(0, ['statistics', 'previousErrors'], dbInterface),
});

// parseDbVlanInterface :: (DbInterface) -> CorrespondenceData
//     DbInterface = Object
//     CorrespondenceData = Object
const parseDbInterfaceVlan = (dbInterface) => {
  if (isNotPlainObject(dbInterface.vlan)) { return null }

  return {
    id: dbInterface.vlan.id,
    interface: parseInterfaceIdentification(dbInterface.vlan.interface),
  };
};

// parseDbPPPoEInterface :: (DbInterface) -> CorrespondenceData
//     DbInterface = Object
//     CorrespondenceData = Object
const parseDbInterfacePPPoE = (dbInterface) => {
  if (isNotPlainObject(dbInterface.pppoe)) { return null }

  return {
    id: dbInterface.pppoe.id,
    interface: parseInterfaceIdentification(dbInterface.pppoe.interface),
    account: getOr(null, ['pppoe', 'account'], dbInterface),
    password: getOr(null, ['pppoe', 'password'], dbInterface),
    defaultRoute: getOr(null, ['pppoe', 'defaultRoute'], dbInterface),
    nameServer: getOr(null, ['pppoe', 'nameServer'], dbInterface),
  };
};

// parseDbInterfaceSwitch :: (DbInterface) -> CorrespondenceData
//     DbInterface = Object
//     CorrespondenceData = Object
const parseDbInterfaceSwitch = (dbInterface) => {
  if (isNotPlainObject(dbInterface.switch)) { return null }

  return {
    ports: parseDbInterfaceSwitchPorts(dbInterface.switch.ports),
    vlanEnabled: getOr(false, ['switch', 'vlanEnabled'], dbInterface),
    vlanCapable: getOr(false, ['switch', 'vlanCapable'], dbInterface),
    ospf: getOr(null, ['switch', 'ospf'], dbInterface),
  };
};

// parseDbInterfaceBridge :: (DbInterface) -> CorrespondenceData
//     DbInterface = Object
//     CorrespondenceData = Object
const parseDbInterfaceBridge = (dbInterface) => {
  if (isNotPlainObject(dbInterface.bridge)) { return null }

  return {
    ports: parseDbInterfaceBridgePorts(dbInterface.bridge.ports),
    aging: getOr(300, ['bridge', 'aging'], dbInterface),
    conntrack: getOr(false, ['bridge', 'conntrack'], dbInterface),
    forwardingDelay: getOr(15, ['bridge', 'forwardingDelay'], dbInterface),
    helloTime: getOr(2, ['bridge', 'helloTime'], dbInterface),
    maxAge: getOr(20, ['bridge', 'maxAge'], dbInterface),
    priority: getOr(32768, ['bridge', 'priority'], dbInterface),
    promiscuous: getOr(false, ['bridge', 'promiscuous'], dbInterface),
    stp: getOr(false, ['bridge', 'stp'], dbInterface),
  };
};

// parseDbInterfacePonAuthentication :: DbInterface -> PonAuthenticationCorrespondenceData
const parseDbInterfacePonAuthentication = (dbInterface) => {
  if (pathSatisfies(isNil, ['ponAuthentication'], dbInterface)) { return null }

  return {
    authorizationType: dbInterface.ponAuthentication.authorizationType,
    preSharedSecret: dbInterface.ponAuthentication.logicalPassword,
    logicalId: dbInterface.ponAuthentication.logicalID,
  };
};

// parseDbInterfacePonStatistics :: DbInterface -> PonStatisticsCorrespondenceData
const parseDbInterfacePonStatistics = (dbInterface) => {
  if (pathSatisfies(isNil, ['ponStatistics'], dbInterface)) { return null }

  return {
    registrationStatus: dbInterface.ponStatistics.registrationStatus,
    transmitPower: dbInterface.ponStatistics.transmitPower,
    receivePower: dbInterface.ponStatistics.receivePower,
    biasCurrent: dbInterface.ponStatistics.biasCurrent,
    distance: dbInterface.ponStatistics.distance,
  };
};

// parseDbInterfacePon :: DbInterface -> PonCorrespondenceData
const parseDbInterfacePon = (dbInterface) => {
  const authentication = parseDbInterfacePonAuthentication(dbInterface);
  const statistics = parseDbInterfacePonStatistics(dbInterface);

  if (isNull(authentication) && isNull(statistics)) { return null }

  return { authentication, statistics };
};

// parseDbInterface :: (Auxiliaries, DbInterface) -> CorrespondenceData
//     Auxiliaries = Object
//     DbInterface = Object
//     CorrespondenceData = Object
const parseDbInterface = dbInterface => ({
  identification: parseInterfaceIdentification(dbInterface.identification),
  statistics: parseDbInterfaceStatistics(dbInterface),
  addresses: isNotArray(dbInterface.addresses) ? [] : dbInterface.addresses,
  mtu: defaultTo(null, dbInterface.mtu),
  poe: parseDbInterfacePoe(dbInterface),
  enabled: getOr(false, ['enabled'], dbInterface),
  proxyARP: getOr(false, ['proxyARP'], dbInterface),
  switch: parseDbInterfaceSwitch(dbInterface),
  speed: parseDbInterfaceSpeed(dbInterface),
  bridgeGroup: getOr(null, ['bridgeGroup'], dbInterface),
  onSwitch: getOr(false, ['onSwitch'], dbInterface),
  isSwitchedPort: getOr(false, ['isSwitchedPort'], dbInterface),
  status: {
    autoneg: getOr(false, ['status', 'autoneg'], dbInterface),
    duplex: getOr(false, ['status', 'duplex'], dbInterface),
    description: parseDbInterfaceStatusDescription(dbInterface),
    plugged: getOr(false, ['status', 'plugged'], dbInterface),
    speed: getOr(0, ['status', 'speed'], dbInterface),
    sfp: getOr(null, ['status', 'sfp'], dbInterface),
  },
  vlan: parseDbInterfaceVlan(dbInterface),
  pppoe: parseDbInterfacePPPoE(dbInterface),
  pon: parseDbInterfacePon(dbInterface),
  bridge: parseDbInterfaceBridge(dbInterface),
  ospf: defaultTo({ ospfCapable: false, ospfConfig: null }, dbInterface.ospf),
});

// parseDbInterfaceList :: (Auxiliaries, Array) -> CorrespondenceList
//     Auxiliaries = Object
//     CorrespondenceList = Array
const parseDbInterfaceList = (auxiliaries, dbInterfaceList) => dbInterfaceList.map(parseDbInterface);

/*
 * Api Parsing
 */

// parseApiInterfaceConfig :: (Object, Object) -> CorrespondenceData
//    CorrespondenceData = Object
const parseApiInterfaceConfig = (auxiliaries, apiInterfaceConfig) => ({
  identification: {
    position: apiInterfaceConfig.identification.position,
    type: apiInterfaceConfig.identification.type,
    name: apiInterfaceConfig.identification.name,
    description: apiInterfaceConfig.identification.description,
    mac: apiInterfaceConfig.identification.mac,
  },
  addresses: (() => {
    if (!Array.isArray(apiInterfaceConfig.addresses)) { return [] }

    return apiInterfaceConfig.addresses.map(pick(['type', 'cidr']));
  })(),
  speed: apiInterfaceConfig.speed,
  mtu: apiInterfaceConfig.mtu,
  proxyARP: apiInterfaceConfig.proxyARP,
  status: {
    description: apiInterfaceConfig.status.description,
    plugged: apiInterfaceConfig.status.plugged,
    speed: apiInterfaceConfig.status.speed,
    duplex: apiInterfaceConfig.status.duplex,
    autoneg: apiInterfaceConfig.status.autoneg,
    sfp: (() => {
      if (isNull(apiInterfaceConfig.status.sfp)) { return null }

      return {
        present: apiInterfaceConfig.status.sfp.present,
        vendor: apiInterfaceConfig.status.sfp.vendor,
        part: apiInterfaceConfig.status.sfp.part,
        maxSpeed: apiInterfaceConfig.status.sfp.maxSpeed,
        olt: apiInterfaceConfig.status.sfp.olt,
      };
    })(),
  },
  statistics: null,
  switch: (() => {
    if (isNull(apiInterfaceConfig.switch)) { return null }

    return {
      vlanEnabled: apiInterfaceConfig.switch.vlanEnabled,
      vlanCapable: apiInterfaceConfig.switch.vlanCapable,
      ports: apiInterfaceConfig.switch.ports.map(({ enabled, pvid, vid, interface: intfc }) => ({
        enabled,
        pvid,
        vid,
        interface: {
          description: intfc.description,
          mac: intfc.mac,
          name: intfc.name,
          position: intfc.position,
          type: intfc.type,
        },
      })),
    };
  })(),
  vlan: (() => {
    if (isNull(apiInterfaceConfig.vlan)) { return null }

    return {
      id: apiInterfaceConfig.vlan.id,
      interface: {
        position: apiInterfaceConfig.vlan.interface.position,
        name: apiInterfaceConfig.vlan.interface.name,
        type: apiInterfaceConfig.vlan.interface.type,
        description: apiInterfaceConfig.vlan.interface.description,
        mac: apiInterfaceConfig.vlan.interface.mac,
      },
    };
  })(),
  pppoe: (() => {
    if (isNull(apiInterfaceConfig.pppoe)) { return null }

    return {
      id: apiInterfaceConfig.pppoe.id,
      interface: {
        position: apiInterfaceConfig.pppoe.interface.position,
        name: apiInterfaceConfig.pppoe.interface.name,
        type: apiInterfaceConfig.pppoe.interface.type,
        description: apiInterfaceConfig.pppoe.interface.description,
        mac: apiInterfaceConfig.pppoe.interface.mac,
      },
      account: apiInterfaceConfig.pppoe.account,
      password: apiInterfaceConfig.pppoe.password,
      defaultRoute: null,
      nameServer: null,
    };
  })(),
  pon: (() => {
    if (isNull(apiInterfaceConfig.pon)) { return null }

    return {
      authentication: {
        authorizationType: apiInterfaceConfig.pon.authentication.authorizationType,
        preSharedSecret: apiInterfaceConfig.pon.authentication.preSharedSecret,
        logicalId: null,
      },
      statistics: null,
    };
  })(),
  bridge: (() => {
    if (isNull(apiInterfaceConfig.bridge)) { return null }

    return {
      aging: null,
      conntrack: null,
      forwardingDelay: apiInterfaceConfig.bridge.forwardingDelay,
      helloTime: apiInterfaceConfig.bridge.helloTime,
      maxAge: apiInterfaceConfig.bridge.maxAge,
      priority: apiInterfaceConfig.bridge.priority,
      promiscuous: null,
      stp: apiInterfaceConfig.bridge.stp,
      ports: apiInterfaceConfig.bridge.ports,
    };
  })(),
  poe: {
    output: apiInterfaceConfig.poe.output,
    capacities: apiInterfaceConfig.poe.capacities,
  },
  enabled: apiInterfaceConfig.enabled,
  ospf: null,
});

// parseApiInterfaceOspfConfig :: (Object, Object) -> CorrespondenceData
//    CorrespondenceData = Object
const parseApiInterfaceOspfConfig = (auxiliaries, apiInterfaceOspfConfig) => ({
  ospfCapable: true,
  ospfConfig: {
    cost: pathOr(null, ['cost'], apiInterfaceOspfConfig),
    auth: pathOr(null, ['auth'], apiInterfaceOspfConfig),
    authKey: pathOr(null, ['authKey'], apiInterfaceOspfConfig),
  },
});

// parseInterfaceListAddresses :: Auxiliaries -> Array.<CorrespondenceData> -> Array
//    Auxiliaries = Object
//    CorrespondenceData = Object
const parseInterfaceListAddresses = curry((auxiliaries, interfaceList) => flow(
  flatMap(get('addresses')),
  map(get('cidr')),
  filter(isString)
)(interfaceList));

// parseInterfaceListSwitchAddress :: Auxiliaries -> Array.<CorrespondenceData> -> String
//    Auxiliaries = Object
//    CorrespondenceData = Object
const parseInterfaceListSwitchAddress = curry((auxiliaries, interfaceList) => flow(
  find(pathEq(['identification', 'type'], InterfaceIdentificationTypeEnum.Switch)),
  getOr([], 'addresses'),
  map(getOr(null, 'cidr')),
  head,
  defaultTo(null)
)(interfaceList));

// parseInterfaceListEnabled :: Array.<CorrespondenceData> -> Array.<CorrespondenceData>
//    CorrespondenceData = Object
const parseInterfaceListEnabled = filter(pathEq(['enabled'], true));

// parseInterfaceListPlugged :: Array.<CorrespondenceData> -> Array.<CorrespondenceData>
//    CorrespondenceData = Object
const parseInterfaceListPlugged = filter(pathEq(['status', 'plugged'], true));

// isIpInSameSubnetAsGateway :: String -> String -> Boolean
const isIpInSameSubnetAsGateway = curry((gateway, ipAddress) => ip.cidrSubnet(ipAddress).contains(gateway));

// parseGatewaySameSubnetAddresses :: String -> Array.<IpAddress> -> Array.<IpAddress>
//    IpAddress = String
const parseGatewaySameSubnetAddresses = gateway => filter(isIpInSameSubnetAsGateway(gateway));

// toLong :: String -> Number
const toLong = ipAddress => ip.toLong(cidrToIp(ipAddress));

// parseAddressListLowestIpAddress :: Array.<String> -> String
const parseAddressListLowestIpAddress = reduce(minBy(toLong), '255.255.255.255/32');

// parseInterfaceListIpAddressCidr :: Auxiliaries -> Array.<CorrespondenceData> -> String
//    Auxiliaries = Object
//    CorrespondenceData = Object
const parseInterfaceListIpAddressCidr = curry(({ gateway }, interfaces) => {
  if (isNotArray(interfaces)) { return null }
  if (isNil(gateway)) { return parseInterfaceListSwitchAddress({}, interfaces) }

  return flow(
    parseInterfaceListEnabled,
    parseInterfaceListPlugged,
    parseInterfaceListAddresses({}),
    parseGatewaySameSubnetAddresses(gateway),
    parseAddressListLowestIpAddress,
    when(eq('255.255.255.255/32'), stubNull)
  )(interfaces);
});


module.exports = {
  parseDbInterfaceSpeed,
  parseDbInterfaceStatusDescription,

  parseDbInterface,
  parseDbInterfaceList,

  parseApiInterfaceConfig,
  parseApiInterfaceOspfConfig,

  parseInterfaceListAddresses,
  parseInterfaceListIpAddressCidr,

  safeParseDbInterface: liftParser(parseDbInterface),
  safeParseDbInterfaceList: liftParser(parseDbInterfaceList),
  safeParseApiInterfaceConfig: liftParser(parseApiInterfaceConfig),
  safeParseApiInterfaceOspfConfig: liftParser(parseApiInterfaceOspfConfig),
  safeParseInterfaceListAddresses: liftParser(parseInterfaceListAddresses),
  safeParseInterfaceListIpAddressCidr: liftParser(parseInterfaceListIpAddressCidr),
};
