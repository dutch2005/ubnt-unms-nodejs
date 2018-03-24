'use strict';

const joi = require('joi');
const { Chance } = require('chance');
const boom = require('boom');
const { map, getOr, find, curry, constant } = require('lodash/fp');
const { flow, /* pull, */unset, merge } = require('lodash');
const { assocPath, assoc, pathSatisfies, pathEq, ifElse } = require('ramda');

const { registerPlugin } = require('../../util/hapi');
const {
  isEthernetInterfaceType, isVlanInterfaceType, isSfpInterfaceType, isPonInterfaceType, isPPPoEInterfaceType,
  isBridgeInterfaceType, isSwitchInterfaceType,
} = require('../../transformers/interfaces/utils');
const validation = require('../../validation');
const {
  IpAddressTypeEnum, InterfaceIdentificationTypeEnum, DeviceTypeEnum, DeviceModelEnum, PoeOutputEnum,
  PonAuthorizationTypeEnum, InterfaceSpeedEnum, InterfaceMaxSpeedEnum, StatusEnum, OspfAuthTypeEnum,
} = require('../../enums');

// chance generator instance.
const chance = new Chance();

/*
 * Fixtures
 */

/*
 * Interfaces
 */

const generateOspf = () => {
  const auth = OspfAuthTypeEnum[Object.keys(OspfAuthTypeEnum)[chance.integer({ min: 0, max: 2 })]];
  const authKey = auth === OspfAuthTypeEnum.None ? null : chance.string();
  const cost = chance.integer({ min: 0, max: 100 });

  return { ospfCapable: true, ospfConfig: { auth, authKey, cost } };
};

const getOspf = flow(
  ifElse(
    () => chance.bool({ likelihood: 40 }),
    generateOspf,
    constant({ ospfCapable: true, ospfConfig: null })
  )
);

const generateSFP = (sfp, olt, maxSpeed) => {
  if (sfp) {
    return {
      present: true,
      vendor: 'OEM',
      part: 'UF+SM-0G',
      olt,
      maxSpeed,
    };
  }
  return null;
};

const generateInterfaceIdentification = (position, type) => ({
  position,
  type,
  name: `${type}${position}`,
  displayName: `${type}${position}`,
  description: null,
  mac: `04:1${position}:d6:a2:08:7e`,
  visible: true,
});

// generateEthernetConfig :: Object(EthernetInterface) -> Object(EthernetConfig)
const generateEthernetConfig = ({ identification, enabled, status, addresses, poe }) => ({
  identification,
  addresses,
  status,
  enabled,
  poe,
  poeWatchdog: false,
  speed: 'auto',
  mtu: 1500,
  proxyARP: false,
});

// generatePonConfig :: Object(EthernetInterface) -> Object(PonConfig)
const generatePonConfig = ({ identification, enabled, status, addresses }) => ({
  identification,
  addresses,
  status,
  enabled,
  poe: {
    output: null,
    capacities: [],
  },
  speed: null,
  mtu: null,
  proxyARP: null,
  pon: {
    authentication: {
      authorizationType: PonAuthorizationTypeEnum.PSK,
      preSharedSecret: '58967fhnoierytyi',
    },
  },
});

const generateBridgeConfig = ({ identification, enabled, status, addresses }) => ({
  identification,
  addresses,
  status,
  enabled,
  poe: {
    output: null,
    capacities: [],
  },
  speed: null,
  mtu: null,
  proxyARP: null,
  pon: null,
  switch: null,
  bridge: {
    priority: 32768,
    forwardingDelay: 15,
    helloTime: 2,
    maxAge: 20,
    stp: true,
    ports: [
      {
        enabled: true,
        interface: {
          name: 'eth0',
          description: null,
          displayName: 'eth0',
          position: 0,
          mac: null,
          type: InterfaceIdentificationTypeEnum.Ethernet,
        },
      },
      {
        enabled: false,
        interface: {
          name: 'eth5',
          description: null,
          displayName: 'eth5',
          position: 5,
          mac: null,
          type: InterfaceIdentificationTypeEnum.Ethernet,
        },
      },
    ],
  },
});

const generateSwitchConfig = (switchInterface, ethernetInterfaces) => {
  const config = {
    identification: switchInterface.identification,
    addresses: switchInterface.addresses,
    enabled: switchInterface.enabled,
    mtu: switchInterface.mtu || 1500,
    proxyARP: switchInterface.proxyARP || false,
    poe: {
      output: null,
      capacities: [],
    },
    poeWatchdog: null,
    speed: null,
    switch: {
      vlanEnabled: getOr(false, ['switch', 'vlanEnabled'], switchInterface),
      vlanCapable: true,
      ports: [],
    },
  };

  const switchPorts = ethernetInterfaces.map(({ identification }, i) => ({
    interface: identification,
    enabled: flow(
      getOr([], ['switch', 'ports']),
      find(pathEq(['interface', 'name'], identification.name)),
      getOr(false, ['enabled'])
    )(switchInterface),
    pvid: getOr(null, ['switch', 'ports', i, 'pvid'], switchInterface),
    vid: getOr([], ['switch', 'ports', i, 'vid'], switchInterface),
  }));

  return assocPath(['switch', 'ports'], switchPorts, config);
};

const generateVlanConfig = (vlanInterface, ethernetInterface) => ({
  identification: vlanInterface.identification,
  addresses: vlanInterface.addresses,
  enabled: vlanInterface.enabled,
  status: ethernetInterface.status,
  mtu: 1500,
  poe: {
    output: null,
    capacities: [],
  },
  poeWatchdog: null,
  speed: null,
  proxyARP: null,
  vlan: {
    id: 234,
    interface: ethernetInterface.identification,
  },
});

const generatePPPOEConfig = (pppoeInterface, ethernetInterface) => ({
  identification: pppoeInterface.identification,
  addresses: pppoeInterface.addresses,
  enabled: pppoeInterface.enabled,
  status: ethernetInterface.status,
  mtu: 1500,
  poe: {
    output: null,
    capacities: [],
  },
  poeWatchdog: null,
  speed: null,
  proxyARP: null,
  pppoe: {
    id: 2342,
    interface: ethernetInterface.identification,
    account: 'account',
    password: 'password',
  },
});

const generateInterfaceStatistics = intfc => ({
  dropped: getOr(0, ['statistics', 'dropped'], intfc) + chance.natural({ min: 0, max: 1 }),
  errors: getOr(0, ['statistics', 'errors'], intfc) + chance.natural({ min: 0, max: 1 }),
  rxbytes: getOr(0, ['statistics', 'rxbytes'], intfc) + chance.natural({ min: 1000, max: 2000 }),
  txbytes: getOr(0, ['statistics', 'txbytes'], intfc) + chance.natural({ min: 1000, max: 2000 }),
  timestamp: Date.now(),
  rxrate: chance.natural({ min: 1000000, max: 10000000 }),
  txrate: chance.natural({ min: 200000, max: 900000 }),
});

const generateBasicInterface = (type, id) => ({
  identification: generateInterfaceIdentification(id, type),
  addresses: [],
  status: { status: StatusEnum.Active },
  statistics: generateInterfaceStatistics(),
  poe: {
    output: null,
    capacities: [],
  },
  enabled: true,
  visible: true,
  ospf: getOspf(),
  canDisplayStatistics: true,
});

const generateSwitchType1 = (id) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Switch, id);
  return Object.assign({}, int, {
    addresses: [
      chance.pickone([
        { type: IpAddressTypeEnum.Dhcp, cidr: null },
        { type: IpAddressTypeEnum.Static, cidr: `${chance.ip()}/24` },
      ]),
    ],
    switch: {
      vlanEnabled: chance.bool(),
      vlanCapable: true,
      ports: [],
    },
  });
};

const generateEthernetType1 = (id, poe, sfp) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Ethernet, id);
  return Object.assign({}, int, {
    addresses: [{ type: IpAddressTypeEnum.Dhcp, cidr: null }],
    status: {
      status: StatusEnum.Active,
      description: '10 Mbps - Full Duplex',
      plugged: true,
      speed: 10,
      duplex: true,
      autoneg: false,
      sfp: generateSFP(sfp, false, 1000),
    },
    poe,
  });
};

const generateEthernetType2 = (id, poe, sfp) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Ethernet, id);
  return Object.assign({}, int, {
    addresses: [
      { type: IpAddressTypeEnum.Static, cidr: '192.168.100.100/29' },
      { type: IpAddressTypeEnum.Static, cidr: '192.168.100.101/29' },
      { type: IpAddressTypeEnum.Static, cidr: '192.168.100.102/29' },
    ],
    status: {
      status: StatusEnum.Active,
      description: '100 Mbps - Full Duplex',
      plugged: true,
      speed: 100,
      duplex: false,
      autoneg: false,
      sfp: generateSFP(sfp, false, 1000),
    },
    poe,
  });
};

const generateEthernetType3 = (id, poe, sfp) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Ethernet, id);
  return Object.assign({}, int, {
    poe,
    addresses: [
      { type: IpAddressTypeEnum.Static, cidr: '192.168.101.31/27' },
      { type: IpAddressTypeEnum.Static, cidr: '192.168.102.15/24' },
      { type: IpAddressTypeEnum.Static, cidr: '192.168.102.16/24' },
      { type: IpAddressTypeEnum.Static, cidr: '192.168.102.17/24' },
      { type: IpAddressTypeEnum.Static, cidr: '192.168.102.18/24' },
    ],
    status: {
      status: StatusEnum.Disconnected,
      description: '100 Mbps - Full Duplex',
      plugged: true,
      speed: 100,
      duplex: true,
      autoneg: false,
      sfp: generateSFP(sfp, false, 1000),
    },
    enabled: false,
    canDisplayStatistics: false,
  });
};

const generateEthernetType4 = (id, poe, sfp) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Ethernet, id);
  return Object.assign({}, int, {
    poe,
    addresses: [{ type: IpAddressTypeEnum.Static, cidr: '2001:db8:1000::1/64' }],
    status: {
      status: StatusEnum.Disabled,
      description: '10/100/1000 Auto',
      plugged: true,
      speed: 1000,
      duplex: true,
      autoneg: true,
      sfp: generateSFP(sfp, false, 1000),
    },
    enabled: false,
    canDisplayStatistics: false,
  });
};

const generateEthernetType5 = (id, poe, sfp) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Ethernet, id);
  return Object.assign({}, int, {
    addresses: [{ type: IpAddressTypeEnum.Static, cidr: `${chance.ip()}/24` }],
    status: {
      status: StatusEnum.Active,
      description: '100 Mbps - Full Duplex',
      plugged: true,
      speed: 100,
      duplex: true,
      autoneg: false,
      sfp: generateSFP(sfp, false, 1000),
    },
    enabled: true,
    poe,
  });
};

const generateBridgeType = (id) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Bridge, id);
  return Object.assign({}, int, {
    addresses: [{ type: IpAddressTypeEnum.Static, cidr: '2001:db8:1000::1/64' }],
    status: {
      status: StatusEnum.Active,
      description: null,
      plugged: true,
      speed: 1000,
      duplex: true,
      autoneg: true,
      sfp: null,
    },
    enabled: true,
    canDisplayStatistics: false,
  });
};


const generatePonType1 = (id, sfp) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Pon, id);
  return Object.assign({}, int, {
    addresses: [],
    status: {
      status: StatusEnum.Active,
      description: '2500 Mbps',
      plugged: sfp,
      speed: 2500,
      duplex: true,
      autoneg: true,
      sfp: {
        present: sfp,
        vendor: sfp ? 'OEM' : null,
        part: sfp ? 'RNT-4321S-C2CD' : null,
        olt: true,
        maxSpeed: 2500,
      },
    },
    enabled: true,
    poe: {
      output: null,
      capacities: [],
    },
  });
};

const generateSfpType1 = (id) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.Sfp, id);
  return Object.assign({}, int, {
    addresses: [],
    status: {
      status: StatusEnum.Disconnected,
      description: '1 Gbps',
      plugged: false,
      speed: InterfaceSpeedEnum.Full1000,
      duplex: true,
      autoneg: true,
      sfp: {
        present: true,
        vendor: 'OEM',
        part: 'UF+SM-0G',
        olt: true,
        maxSpeed: InterfaceMaxSpeedEnum.Max10Gb,
      },
    },
    enabled: false,
    poe: {
      output: null,
      capacities: [],
    },
    canDisplayStatistics: false,
  });
};

const generateVlanType1 = (id, vlan, port, ethernetInterface) => flow(
  generateBasicInterface,
  assocPath(['identification', 'name'], `${port}.${vlan}`),
  assocPath(['identification', 'description'], `${port}.${vlan}`),
  assoc('addresses', [{ type: IpAddressTypeEnum.Static, cidr: `${chance.ip()}/24` }]),
  assoc('statistics', null),
  assoc('vlan', {
    id: vlan,
    interface: ethernetInterface.identification,
  })
)(InterfaceIdentificationTypeEnum.Vlan, id);

const generatePPPOEType1 = (id) => {
  const int = generateBasicInterface(InterfaceIdentificationTypeEnum.PPPoE, id);
  return Object.assign({}, int, {
    statistics: null,
  });
};

let vlanPosition = 0;
let pppoePosition = 0;

const generateErouterInterfaces = (model) => {
  const noPoESupport = {
    output: null,
    capacities: [],
  };
  const poESupportOn = {
    output: PoeOutputEnum.V24,
    capacities: [PoeOutputEnum.V24, PoeOutputEnum.V48, PoeOutputEnum.OFF],
  };
  const poESupportOff = {
    output: PoeOutputEnum.OFF,
    capacities: [PoeOutputEnum.V24, PoeOutputEnum.V48, PoeOutputEnum.OFF],
  };

  switch (model) {
    case DeviceModelEnum.ERX: return [
      generateEthernetType1(0, noPoESupport, false),
      generateEthernetType2(1, noPoESupport, false),
      generateEthernetType3(2, noPoESupport, false),
      generateEthernetType4(3, noPoESupport, false),
      generateEthernetType5(4, noPoESupport, false),
      generateSwitchType1(0),
      generateVlanType1(0, 1422, 'eth2', generateEthernetType3(2, noPoESupport)),
      generatePPPOEType1(0),
    ];
    case DeviceModelEnum.EPR6: return [
      generateEthernetType1(0, poESupportOn, false),
      generateEthernetType2(1, poESupportOn, false),
      generateEthernetType3(2, poESupportOn, false),
      generateEthernetType4(3, poESupportOn, false),
      generateEthernetType5(4, poESupportOn, false),
      generateEthernetType5(5, noPoESupport, true),
      generateSwitchType1(0),
    ];
    case DeviceModelEnum.EPR8: return [
      generateEthernetType1(0, poESupportOn, false),
      generateEthernetType2(1, poESupportOn, false),
      generateEthernetType3(2, poESupportOn, false),
      generateEthernetType4(3, poESupportOn, false),
      generateEthernetType5(4, poESupportOn, false),
      generateEthernetType5(5, poESupportOn, false),
      generateEthernetType5(6, poESupportOn, false),
      generateEthernetType5(7, poESupportOn, false),
      generateEthernetType5(8, poESupportOn, false),
    ];
    case DeviceModelEnum.ERXSFP: return [
      generateEthernetType1(0, poESupportOff, false),
      generateEthernetType2(1, poESupportOn, false),
      generateEthernetType3(2, poESupportOn, false),
      generateEthernetType4(3, poESupportOn, false),
      generateEthernetType5(4, poESupportOff, false),
      generateEthernetType5(5, noPoESupport, true),
      generateSwitchType1(0),
    ];
    case DeviceModelEnum.ER8XG: return [
      generateEthernetType1(0, noPoESupport, false),
      generateEthernetType2(1, noPoESupport, true),
      generateEthernetType3(2, noPoESupport, true),
      generateEthernetType4(3, noPoESupport, true),
      generateEthernetType5(4, noPoESupport, true),
      generateEthernetType5(5, noPoESupport, true),
      generateEthernetType5(6, noPoESupport, true),
      generateEthernetType5(7, noPoESupport, true),
      generateEthernetType5(8, noPoESupport, true),
    ];
    case DeviceModelEnum.ERPro8: return [
      generateEthernetType1(0, noPoESupport, false),
      generateEthernetType2(1, noPoESupport, false),
      generateEthernetType3(2, noPoESupport, false),
      generateEthernetType4(3, noPoESupport, false),
      generateEthernetType5(5, noPoESupport, false),
      generateEthernetType5(6, noPoESupport, true),
      generateEthernetType5(7, noPoESupport, true),
      generateVlanType1(0, 1, 'eth0', generateEthernetType1(0, noPoESupport)),
      generateVlanType1(1, 2, 'eth1', generateEthernetType2(1, noPoESupport)),
    ];
    default: return [
      generateEthernetType1(0, noPoESupport, false),
      generateEthernetType2(1, noPoESupport, false),
      generateEthernetType3(2, noPoESupport, false),
      generateEthernetType4(3, noPoESupport, false),
      generateEthernetType5(4, noPoESupport, false),
      generateSwitchType1(0),
      generateVlanType1(0, 1422, 'eth2', generateEthernetType3(2, noPoESupport)),
      generatePPPOEType1(0),
    ];
  }
};

const generateOltInterfaces = () => [
  generateBridgeType(0),
  generatePonType1(0, true),
  generatePonType1(1, true),
  generatePonType1(2, true),
  generatePonType1(3, true),
  generatePonType1(4, true),
  generatePonType1(5, false),
  generatePonType1(6, false),
  generatePonType1(7, false),
  generateSfpType1(0),
  generateSfpType1(1),
];

const deviceInterfacesMap = new Map();

/*
 * Business logic
 */

const interfaceNamePath = ['identification', 'name'];
const switchInterfaceSelector = pathSatisfies(isSwitchInterfaceType, interfaceNamePath);
const pppoeInterfaceSelector = pathSatisfies(isPPPoEInterfaceType, interfaceNamePath);
const vlanInterfaceSelector = pathSatisfies(isVlanInterfaceType, interfaceNamePath);
const ethernetInterfaceSelector = pathSatisfies(isEthernetInterfaceType, interfaceNamePath);
const sfpInterfaceSelector = pathSatisfies(isSfpInterfaceType, interfaceNamePath);
const ponInterfaceSelector = pathSatisfies(isPonInterfaceType, interfaceNamePath);
const bridgeInterfaceSelector = pathSatisfies(isBridgeInterfaceType, interfaceNamePath);

// getDeviceInterfaces :: Object(DeviceIdentification) -> Array(Interface)
const getDeviceInterfaces = ({ id: deviceId, type: deviceType, model: deviceModel }) => {
  if (deviceInterfacesMap.has(deviceId)) { return deviceInterfacesMap.get(deviceId) }
  let interfaces;

  switch (deviceType) {
    case DeviceTypeEnum.Erouter: {
      interfaces = generateErouterInterfaces(deviceModel);
      break;
    }
    case DeviceTypeEnum.Olt: {
      interfaces = generateOltInterfaces(deviceModel);
      break;
    }
    default: {
      interfaces = [];
      break;
    }
  }

  deviceInterfacesMap.set(deviceId, interfaces);
  return interfaces;
};

const getConfigForInterface = (intfc, allInterfaces) => {
  if (switchInterfaceSelector(intfc)) {
    return generateSwitchConfig(intfc, allInterfaces.filter(ethernetInterfaceSelector));
  } else if (pppoeInterfaceSelector(intfc)) {
    return generatePPPOEConfig(intfc, allInterfaces[1]);
  } else if (vlanInterfaceSelector(intfc)) {
    return generateVlanConfig(intfc, allInterfaces[2]);
  } else if (ethernetInterfaceSelector(intfc) || sfpInterfaceSelector(intfc)) {
    return generateEthernetConfig(intfc);
  } else if (ponInterfaceSelector(intfc)) {
    return generatePonConfig(intfc);
  } else if (bridgeInterfaceSelector(intfc)) {
    return generateBridgeConfig(intfc);
  }
  return boom.badData();
};

const updateInterfaceStatistics = (intfc) => {
  if (intfc.statistics === null || !intfc.enabled || !intfc.status ||
    (intfc.status && !intfc.status.plugged)) {
    intfc.statistics = null; // eslint-disable-line no-param-reassign
  }
  intfc.statistics = generateInterfaceStatistics(intfc); // eslint-disable-line no-param-reassign

  return intfc;
};

const storeDeviceInterfaces = curry((device, intfcs) => {
  /* eslint-disable */
  device.interfaces = intfcs;
  /* eslint-enable */
  return intfcs;
});

// deviceSelector :: String(deviceId) -> Object(Device) -> Boolean
const deviceSelector = pathEq(['identification', 'id']);
// interfaceSelector :: String(interfaceName) -> Object(Interface) -> Boolean
const interfaceSelector = pathEq(['identification', 'name']);

/*
 * Route definitions
 */

function register(server, options) {
  // device fixtures.
  const { devices } = server.plugins.fixtures.devices;
  options.model.deviceInterfaceMap = deviceInterfacesMap; // eslint-disable-line no-param-reassign

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{deviceId}/interfaces',
    config: {
      auth: false,
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const device = devices.find(deviceSelector(request.params.deviceId));

      reply(
        Promise
          .resolve(device.identification)
          .then(getDeviceInterfaces)
          .then((intfc) => {
            if (device.identification.type === DeviceTypeEnum.AirCube) {
              return device.interfaces;
            }

            return intfc;
          })
          .then(map(updateInterfaceStatistics))
          .then(storeDeviceInterfaces(device))
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{deviceId}/interfaces/vlan',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
        payload: {
          description: joi.string().optional().allow(null),
          interface: joi.string().required(),
          mtu: joi.number().integer().required(),
          vlanId: joi.number().integer().required(),
          addresses: joi.array().items(joi.object()).required(),
        },
      },
    },
    handler(request, reply) {
      vlanPosition += 1;
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const ethernetInterface = interfaces.find(interfaceSelector(request.payload.interface));
      // TODO(vladimir.gorej@gmail.com): due to the fact that we do not store interface configs,
      // TODO(vladimir.gorej@gmail.com): only interface overviews, there is no way to create vlan interface properly.
      // TODO(vladimir.gorej@gmail.com): the only simple and viable solution is to have interfaces and configs
      // TODO(vladimir.gorej@gmail.com): have pre-generated.
      const vlanInterface = generateVlanType1(
        vlanPosition,
        1422 + vlanPosition,
        `eth${vlanPosition}`,
        generateEthernetType3(2)
      );
      interfaces.push(vlanInterface);
      reply(generateVlanConfig(vlanInterface, ethernetInterface));
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{deviceId}/interfaces/pppoe',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
        },
        payload: {
          id: joi.number().integer().min(0).max(4094).required(),
          mtu: joi.number().integer().min(68).max(2018).required(),
          interface: joi.string().required(),
          password: joi.string().min(4).max(20).required(),
          account: joi.string().optional().allow(null),
        },
      },
    },
    handler(request, reply) {
      pppoePosition += 1;
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const ethernetInterface = interfaces.find(interfaceSelector(request.payload.interface));
      // TODO(vladimir.gorej@gmail.com): due to the fact that we do not store interface configs,
      // TODO(vladimir.gorej@gmail.com): only interface overviews, there is no way to create pppoe interface properly.
      // TODO(vladimir.gorej@gmail.com): the only simple and viable solution is to have interfaces and configs
      // TODO(vladimir.gorej@gmail.com): have pre-generated.
      const pppoeInterface = generatePPPOEType1(pppoePosition);
      interfaces.push(pppoeInterface);
      reply(generateVlanConfig(pppoeInterface, ethernetInterface));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      console.dir(request.params.interfaceName);
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      try {
        console.dir(getConfigForInterface(intfc, interfaces));
      } catch (e) {
        console.dir(e);
      }

      reply(getConfigForInterface(intfc, interfaces));
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      // remove all keys from the object
      Object.keys(intfc).forEach((key) => { unset(intfc, key) });
      merge(intfc, request.payload);
      reply(request.payload);
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      // const device = devices.find(deviceSelector(request.params.deviceId));
      // const interfaces = getDeviceInterfaces(device.identification);
      // const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      // pull(interfaces, intfc);
      reply({ result: true, message: 'Device deleted' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}/block',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      intfc.enabled = false;
      reply({ result: true, message: 'Interface blocked' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}/unblock',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      intfc.enabled = true;
      reply({ result: true, message: 'Interface unblocked' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}/resetstats',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      intfc.statistics.dropped = 0;
      intfc.statistics.errors = 0;
      intfc.statistics.rxbytes = 0;
      intfc.statistics.txbytes = 0;
      reply({ result: true, message: 'Interface statistics reset' });
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}/ospf',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
        payload: {
          auth: joi.string().required(),
          authKey: joi.string().allow(null),
          cost: joi.number().required(),
        },
      },
    },
    handler(request, reply) {
      const device = devices.find(deviceSelector(request.params.deviceId));
      const interfaces = getDeviceInterfaces(device.identification);
      const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      intfc.ospf = request.payload;
      reply(request.payload);
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/devices/{deviceId}/interfaces/{interfaceName}/ospf',
    config: {
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      // const device = devices.find(deviceSelector(request.params.deviceId));
      // const interfaces = getDeviceInterfaces(device.identification);
      // const intfc = interfaces.find(interfaceSelector(request.params.interfaceName));

      // intfc.ospf = null;
      reply().code(204);
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'interfaces_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
