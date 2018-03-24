'use strict';

const { allPass, pathSatisfies, path, pathEq, when, view, ifElse, converge, unapply } = require('ramda');
const {
  flow, isNull, toPairs, map, getOr, stubTrue, cond, partial, groupBy, get, defaultTo, isString, eq, filter, curry,
  constant, has, isUndefined, stubObject, mergeAll, set, __, flatMap, T, isPlainObject, assign, flatten,
} = require('lodash/fp');
const { isNotNull, isNotNil } = require('ramda-adjunct');

const { lensSatisfies, viewOr, isNotEqual } = require('../../../../../util');
const {
  interfaceNameToType, isPonInterfaceType, isBridgeInterfaceType, isEthernetInterfaceType, interfaceNameToPosition,
  ospfCostLens, ospfMd5AuthLens, ospfLens, ospfPlaintextAuthLens, isPPPoEInterfaceType, isVlanInterfaceType,
  isSwitchInterfaceType, interfaceNameToHwProps,
} = require('../../../../../transformers/interfaces/utils');
const {
  InterfaceIdentificationTypeEnum, PonAuthorizationTypeEnum, IpAddressTypeEnum, InterfaceSpeedEnum, PoeOutputEnum,
  OspfAuthTypeEnum,
} = require('../../../../../enums');

/*
 * HW parsing
 */

// parseHwInterfaceOspfAuthMd5 :: Object -> Object
const parseHwInterfaceOspfAuthMd5 = hwInterface => ifElse(
  lensSatisfies(isNotNil, ospfMd5AuthLens),
  constant({
    auth: OspfAuthTypeEnum.Md5,
    authKey: view(ospfMd5AuthLens, hwInterface),
  }),
  stubObject
)(hwInterface);

// parseHwInterfaceOspfAuthPlaintext :: Object -> Object
const parseHwInterfaceOspfAuthPlaintext = hwInterface => ifElse(
  lensSatisfies(isNotNil, ospfPlaintextAuthLens),
  constant({
    auth: OspfAuthTypeEnum.Plaintext,
    authKey: view(ospfPlaintextAuthLens, hwInterface),
  }),
  stubObject
)(hwInterface);

// parseHwInterfaceOspfCost :: Object -> Object
const parseHwInterfaceOspfCost = hwInterface => ({
  cost: viewOr(null, ospfCostLens, hwInterface),
});

// parseHwInterfaceOspf :: Object -> Object
const parseHwInterfaceOspf = ifElse(
  lensSatisfies(isNotNil, ospfLens),
  flow(
    converge(unapply(mergeAll), [
      constant({ cost: null, auth: OspfAuthTypeEnum.None, authKey: null }),
      parseHwInterfaceOspfCost,
      parseHwInterfaceOspfAuthMd5,
      parseHwInterfaceOspfAuthPlaintext,
    ]),
    set(['ospfConfig'], __, { ospfCapable: true })
  ),
  constant({ ospfCapable: true, ospfConfig: null })
);

// parseHwInterfaceDescription :: {description: String} -> String
const parseHwInterfaceDescription = cond([
  [pathSatisfies(isString, ['description']), path(['description'])],
  [stubTrue, constant(null)],
]);

// parseHwInterfacePonAuthentication :: Object -> Object
const parseHwInterfacePonAuthentication = (hwInterface) => {
  if (!isPonInterfaceType(hwInterface.name)) { return null }

  const authorizationType = pathSatisfies(eq('pre-shared-secret'), ['authentication', 'mode'], hwInterface)
    ? PonAuthorizationTypeEnum.PSK
    : PonAuthorizationTypeEnum.NoAuth;
  const preSharedSecret = getOr(null, ['authentication', 'pre-shared-secret'], hwInterface);

  return { authorizationType, preSharedSecret, logicalId: null };
};

// parseHwInterfaceSpeed :: Object -> String
const parseHwInterfaceSpeed = (hwInterface) => {
  const speed = getOr(null, ['speed'], hwInterface);
  const duplex = get(['duplex'], hwInterface);

  if (speed === 'auto') {
    return InterfaceSpeedEnum.Auto;
  } else if (isNull(speed)) {
    return null;
  } else if (isUndefined(duplex)) {
    return speed;
  }

  return `${speed}-${duplex ? 'full' : 'half'}`;
};

// parseHwInterfaceSwitchEthernetPort :: Object -> Object -> SwitchProp
//     SwitchProps = Object
const parseHwInterfaceSwitchEthernetPort = curry((hwSwitchPort, hwInterface) => {
  const { name } = hwInterface;
  const enabled = has(['interface', name], hwSwitchPort);
  const pvid = flow(
    getOr(null, ['interface', name, 'vlan', 'pvid']),
    when(isNotNull, Number)
  )(hwSwitchPort);
  const vid = flow(
    getOr([], ['interface', name, 'vlan', 'vid']),
    map(Number)
  )(hwSwitchPort);

  return {
    interface: {
      position: interfaceNameToPosition(name),
      name,
      type: interfaceNameToType(name),
      description: parseHwInterfaceDescription(hwInterface),
      mac: null,
    },
    enabled,
    pvid,
    vid,
  };
});

// parseHwInterfaceSwitch :: (Auxiliaries, Object) -> Object
//     Auxiliaries = {dbDevice: Object, dbInterfaceList: Array}
const parseHwInterfaceSwitch = ({ features, hwInterfaceList }, hwInterface) => {
  if (!isSwitchInterfaceType(hwInterface.name)) { return null }

  const hwSwitchPort = hwInterface['switch-port'];
  const ports = hwInterfaceList
    .filter(pathSatisfies(isEthernetInterfaceType, ['name']))
    .map(parseHwInterfaceSwitchEthernetPort(hwSwitchPort));
  const vlanEnabled = pathSatisfies(eq('enable'), ['vlan-aware'], hwSwitchPort);
  const vlanCapable = features.isVlanCapableOnSwitch;
  const ospf = parseHwInterfaceOspf(hwInterface);

  return { vlanEnabled, vlanCapable, ports, ospf };
};

// parseHwInterfacePoe :: (Auxiliaries, Object) -> Boolean|null
//     Auxiliaries = Object
const parseHwInterfacePoe = ({ features }, hwInterface) => {
  const interfaceName = getOr(null, ['name'], hwInterface);
  const capacities = getOr([], [interfaceName], features.poe);
  const isPoeCapable = capacities.length > 0;
  const defaultPoe = isPoeCapable ? PoeOutputEnum.OFF : null;

  return {
    output: getOr(defaultPoe, ['poe', 'output'], hwInterface),
    capacities,
  };
};

// isHwIpAddressDhcp :: HwAddressSection -> Boolean
//     HwAddressSection = String
const isHwIpAddressDhcp = eq(IpAddressTypeEnum.Dhcp);
// isHwIpAddressDhcpV6 :: HwAddressSection -> Boolean
//     HwAddressSection = String
const isHwIpAddressDhcpV6 = eq(IpAddressTypeEnum.DhcpV6);

const hwAddressToType = cond([
  [isHwIpAddressDhcp, constant(IpAddressTypeEnum.Dhcp)],
  [isHwIpAddressDhcpV6, constant(IpAddressTypeEnum.DhcpV6)],
  [T, constant(IpAddressTypeEnum.Static)],
]);

// parseHwInterfaceAddresses :: Object -> Array
const parseHwInterfaceAddresses = (hwInterface) => {
  const address = getOr(null, 'address', hwInterface);
  if (address === null) {
    return [];
  }

  const addressGroups = groupBy(hwAddressToType, address);

  const hwStaticAddresses = map(
    cidr => ({ type: IpAddressTypeEnum.Static, cidr }),
    getOr([], IpAddressTypeEnum.Static, addressGroups)
  );
  const hwDhcpAddresses = map(
    constant({ type: IpAddressTypeEnum.Dhcp, cidr: null }),
    getOr([], IpAddressTypeEnum.Dhcp, addressGroups)
  );
  const hwDhcpV6Addresses = map(
    constant({ type: IpAddressTypeEnum.DhcpV6, cidr: null }),
    getOr([], IpAddressTypeEnum.DhcpV6, addressGroups)
  );

  return [...hwStaticAddresses, ...hwDhcpAddresses, ...hwDhcpV6Addresses];
};

// parseHwInterfaceBridge :: (Auxiliaries, Object) -> Object
//     Auxiliaries = Object
const parseHwInterfaceBridge = ({ hwInterfaceList }, hwInterface) => {
  if (!isBridgeInterfaceType(hwInterface.name)) { return null }

  const isHwEthernetInterface = pathSatisfies(isEthernetInterfaceType, ['name']);
  const ports = flow(
    filter(isHwEthernetInterface),
    map(hwEthernetInterface => ({
      enabled: getOr(null, ['bridge-group', 'bridge'], hwEthernetInterface) === hwInterface.name,
      interface: {
        description: parseHwInterfaceDescription(hwEthernetInterface),
        mac: null,
        name: hwEthernetInterface.name,
        position: interfaceNameToPosition(hwEthernetInterface.name),
        type: interfaceNameToType(hwEthernetInterface.name),
      },
    }))
  )(hwInterfaceList);

  return {
    aging: flow(getOr(300, ['aging']), Number)(hwInterface),
    conntrack: pathEq(['bridged-conntrack'], 'enable', hwInterface),
    forwardingDelay: flow(getOr(15, ['forwarding-delay']), Number)(hwInterface),
    helloTime: flow(getOr(2, ['hello-time']), Number)(hwInterface),
    maxAge: flow(getOr(20, ['max-age']), Number)(hwInterface),
    priority: flow(getOr(32768, ['priority']), Number)(hwInterface),
    promiscuous: pathEq(['promiscuous'], 'enabled', hwInterface),
    stp: pathEq(['stp'], 'true', hwInterface),
    ports,
  };
};

// parseHwInterfacePPPoE :: Object -> Object
const parseHwInterfacePPPoE = (hwInterface) => {
  if (!isPPPoEInterfaceType(hwInterface.name)) { return null }

  const hwProps = interfaceNameToHwProps(hwInterface.name);
  const parentInterfaceName = hwInterface.parent.name;

  return {
    id: Number(hwProps.pppoeId),
    interface: {
      position: interfaceNameToPosition(parentInterfaceName),
      name: parentInterfaceName,
      type: interfaceNameToType(parentInterfaceName),
      description: parseHwInterfaceDescription(hwInterface.parent),
      mac: null,
    },
    account: getOr(null, 'user-id', hwInterface),
    password: getOr(null, 'password', hwInterface),
    defaultRoute: getOr(null, 'default-route', hwInterface),
    nameServer: getOr(null, 'name-server', hwInterface),
  };
};

// parseHwInterfaceVlan :: Object -> Object
const parseHwInterfaceVlan = (hwInterface) => {
  if (!isVlanInterfaceType(hwInterface.name)) { return null }

  const hwProps = interfaceNameToHwProps(hwInterface.name);
  const parentInterfaceName = hwInterface.parent.name;

  return {
    id: Number(hwProps.vlanId),
    interface: {
      position: interfaceNameToPosition(parentInterfaceName),
      name: parentInterfaceName,
      type: interfaceNameToType(parentInterfaceName),
      description: parseHwInterfaceDescription(hwInterface.parent),
      mac: null,
    },
  };
};

// parseHwInterfacePon :: Object -> Object
const parseHwInterfacePon = (hwInterface) => {
  if (!isPonInterfaceType(hwInterface.name)) { return null }

  return {
    authentication: parseHwInterfacePonAuthentication(hwInterface),
    statistics: null,
  };
};

// parseHwInterface :: (Object, Object) -> Object
const parseHwInterface = ({ features, hwInterfaceList }, hwInterface) => {
  const type = interfaceNameToType(hwInterface.name);
  const isPppoe = type === InterfaceIdentificationTypeEnum.PPPoE;
  const defaultMtu = isPppoe ? features.defaults.pppoeMtu : features.defaults.mtu;

  return {
    identification: {
      position: interfaceNameToPosition(hwInterface.name),
      name: hwInterface.name,
      type,
      description: parseHwInterfaceDescription(hwInterface),
      mac: null,
    },
    statistics: null,
    addresses: parseHwInterfaceAddresses(hwInterface),
    mtu: defaultTo(defaultMtu, parseInt(hwInterface.mtu, 10)),
    poe: parseHwInterfacePoe({ features }, hwInterface),
    enabled: pathSatisfies(allPass([isNotNull, isNotEqual("''")]), ['disable'], hwInterface),
    proxyARP: pathSatisfies(isNull, ['ip', 'enable-proxy-arp'], hwInterface),
    switch: parseHwInterfaceSwitch({ features, hwInterfaceList }, hwInterface),
    speed: parseHwInterfaceSpeed(hwInterface),
    bridgeGroup: getOr(null, ['bridge-group', 'bridge'], hwInterface),
    status: {
      autoneg: defaultTo(false, hwInterface.autoneg),
      duplex: hwInterface.duplex !== 'half',
      description: null,
      plugged: false,
      speed: 0,
      sfp: null,
    },
    vlan: parseHwInterfaceVlan(hwInterface),
    pppoe: parseHwInterfacePPPoE(hwInterface),
    pon: parseHwInterfacePon(hwInterface),
    bridge: parseHwInterfaceBridge({ hwInterfaceList }, hwInterface),
    ospf: parseHwInterfaceOspf(hwInterface),
  };
};

// flattenHwInterfaceType :: Object -> Array.<HwInterface>
const flattenHwInterfaceType = flow(
  toPairs,
  map(([name, hwInterface]) => Object.assign({}, hwInterface, { name }))
);

// flattenHwInterfaceConfig :: Object -> Array
const flattenHwInterfaceConfig = flow(
  hwInterfaceList => [
    ...flattenHwInterfaceType(getOr({}, 'bridge', hwInterfaceList)),
    ...flattenHwInterfaceType(getOr({}, 'ethernet', hwInterfaceList)),
    ...flattenHwInterfaceType(getOr({}, 'switch', hwInterfaceList)),
    ...flattenHwInterfaceType(getOr({}, 'pon', hwInterfaceList)),
    ...flattenHwInterfaceType(getOr({}, 'nni', hwInterfaceList)),
  ],
  flatMap((hwInterface) => {
    const name = hwInterface.name;
    const unwrappedInterfaces = [hwInterface];
    if (isPlainObject(hwInterface.pppoe)) {
      const hwPppoes = toPairs(hwInterface.pppoe).map(
        ([pppoeId, pppoe]) => assign(pppoe, { name: `${name}.pppoe${pppoeId}`, parent: hwInterface })
      );
      unwrappedInterfaces.push(...hwPppoes);
    }

    if (isPlainObject(hwInterface.vif)) {
      const hwVlans = toPairs(hwInterface.vif).map(
        ([vlanId, vlan]) => assign(vlan, { name: `${name}.${vlanId}`, parent: hwInterface })
      );

      const hwVlanPppoes = hwVlans.filter(pathSatisfies(isPlainObject, ['pppoe'])).map(
        vlan => toPairs(vlan.pppoe).map(
          ([pppoeId, pppoe]) => assign(pppoe, { name: `${vlan.name}.pppoe${pppoeId}`, parent: vlan })
        ));

      unwrappedInterfaces.push(...hwVlans, ...flatten(hwVlanPppoes));
    }

    return unwrappedInterfaces;
  })
);

// parseHwInterfaceList :: (Auxiliaries, Array) -> Array
//     Auxiliaries = Object
const parseHwInterfaceConfig = ({ features }, hwInterfaceConfig) => {
  const hwInterfaceList = flattenHwInterfaceConfig(hwInterfaceConfig);

  return map(partial(parseHwInterface, [{ features, hwInterfaceList }]), hwInterfaceList);
};

module.exports = {
  parseHwInterfaceConfig,
};
