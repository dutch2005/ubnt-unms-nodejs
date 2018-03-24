'use strict';

const { Maybe } = require('monet');
const { pathSatisfies } = require('ramda');
const { get, map, flow, pick, isNull, isNil } = require('lodash/fp');

const { liftMapper, META_KEY } = require('../index');
const { toDisplayName } = require('../interfaces/utils');
const { DeviceTypeEnum, InterfaceIdentificationTypeEnum, StatusEnum } = require('../../enums');


// toApiInterfaceDisplayName :: CorrespondenceDataIdentification -> String
//     CorrespondenceDataIdentification = Object
const toApiInterfaceDisplayName = flow(
  pick(['name', 'description']),
  toDisplayName
);

// toApiInterfaceOverviewVisible :: Object -> Boolean
const toApiInterfaceVisible = (correspondenceData) => {
  const dbDevice = get([META_KEY, 'auxiliaries', 'dbDevice'], correspondenceData);
  const deviceType = get(['identification', 'type'], dbDevice);
  const interfaceType = get(['identification', 'type'], correspondenceData);
  const isEthOnOlt = deviceType === DeviceTypeEnum.Olt && interfaceType === InterfaceIdentificationTypeEnum.Ethernet;

  return !isEthOnOlt;
};

// toApiInterfaceStatus :: Object -> StatusEnum
//     StatusEnum = String
const toApiInterfaceStatus = (correspondenceData) => {
  if (correspondenceData.enabled && !correspondenceData.status.plugged) {
    return StatusEnum.Disconnected;
  } else if (!correspondenceData.enabled) {
    return StatusEnum.Disabled;
  }
  return StatusEnum.Active;
};

// toApiInterfaceOverviewCanDisplayStatistics :: Object -> Boolean
const toApiInterfaceCanDisplayStatistics = (correspondenceData) => {
  const interfaceStatus = toApiInterfaceStatus(correspondenceData);
  const isDisconnected = interfaceStatus === StatusEnum.Disconnected;
  const isDisabled = interfaceStatus === StatusEnum.Disabled;

  return !isDisconnected && !isDisabled;
};

// toApiInterfaceOverview :: Object -> Object
const toApiInterfaceOverview = correspondenceData => ({
  identification: {
    position: correspondenceData.identification.position,
    type: correspondenceData.identification.type,
    name: correspondenceData.identification.name,
    description: correspondenceData.identification.description,
    mac: correspondenceData.identification.mac,
    displayName: toApiInterfaceDisplayName(correspondenceData.identification),
  },
  addresses: correspondenceData.addresses,
  status: {
    status: toApiInterfaceStatus(correspondenceData),
    description: correspondenceData.status.description,
    plugged: correspondenceData.status.plugged,
    speed: correspondenceData.status.speed,
    duplex: correspondenceData.status.duplex,
    autoneg: correspondenceData.status.autoneg,
    sfp: (() => {
      if (isNull(correspondenceData.status.sfp)) { return null }

      return {
        present: correspondenceData.status.sfp.present,
        vendor: correspondenceData.status.sfp.vendor,
        part: correspondenceData.status.sfp.part,
        maxSpeed: correspondenceData.status.sfp.maxSpeed,
        olt: correspondenceData.status.sfp.olt,
      };
    })(),
  },
  visible: toApiInterfaceVisible(correspondenceData),
  onSwitch: correspondenceData.onSwitch,
  isSwitchedPort: correspondenceData.isSwitchedPort,
  canDisplayStatistics: toApiInterfaceCanDisplayStatistics(correspondenceData),
  statistics: (() => {
    if (isNull(correspondenceData.statistics)) { return null }

    const {
      rxbytes, txbytes, dropped, errors,
      previousRxbytes, previousTxbytes, previousDropped, previousErrors,
    } = correspondenceData.statistics;

    return {
      timestamp: correspondenceData.statistics.timestamp,
      rxrate: correspondenceData.statistics.rxrate,
      txrate: correspondenceData.statistics.txrate,
      rxbytes: rxbytes - previousRxbytes,
      txbytes: txbytes - previousTxbytes,
      dropped: dropped - previousDropped,
      errors: errors - previousErrors,
    };
  })(),
  pppoe: Maybe.fromNull(correspondenceData.pppoe).map(pick(['id'])).orSome(null),
  vlan: Maybe.fromNull(correspondenceData.vlan).map(pick(['id'])).orSome(null),
  poe: {
    output: correspondenceData.poe.output,
    capacities: correspondenceData.poe.capacities,
  },
  enabled: correspondenceData.enabled,
  ospf: {
    ospfCapable: correspondenceData.ospf.ospfCapable,
    ospfConfig: (() => {
      if (isNull(correspondenceData.ospf.ospfConfig)) { return null }

      return {
        cost: correspondenceData.ospf.ospfConfig.cost,
        auth: correspondenceData.ospf.ospfConfig.auth,
        authKey: correspondenceData.ospf.ospfConfig.authKey,
      };
    })(),
  },
});

// toApiInterfaceOverviewList :: Array -> Array
const toApiInterfaceOverviewList = map(toApiInterfaceOverview);

// toApiInterfaceConfig :: Object -> Object
const toApiInterfaceConfig = correspondenceData => ({
  identification: {
    position: correspondenceData.identification.position,
    type: correspondenceData.identification.type,
    name: correspondenceData.identification.name,
    description: correspondenceData.identification.description,
    mac: correspondenceData.identification.mac,
    displayName: toApiInterfaceDisplayName(correspondenceData.identification),
  },
  addresses: correspondenceData.addresses,
  speed: correspondenceData.speed,
  mtu: correspondenceData.mtu,
  proxyARP: correspondenceData.proxyARP,
  onSwitch: correspondenceData.onSwitch,
  isSwitchedPort: correspondenceData.isSwitchedPort,
  status: {
    status: toApiInterfaceStatus(correspondenceData),
    description: correspondenceData.status.description,
    plugged: correspondenceData.status.plugged,
    speed: correspondenceData.status.speed,
    duplex: correspondenceData.status.duplex,
    autoneg: correspondenceData.status.autoneg,
    sfp: (() => {
      if (isNull(correspondenceData.status.sfp)) { return null }

      return {
        present: correspondenceData.status.sfp.present,
        vendor: correspondenceData.status.sfp.vendor,
        part: correspondenceData.status.sfp.part,
        maxSpeed: correspondenceData.status.sfp.maxSpeed,
        olt: correspondenceData.status.sfp.olt,
      };
    })(),
  },
  switch: (() => {
    if (isNull(correspondenceData.switch)) { return null }

    return {
      vlanEnabled: correspondenceData.switch.vlanEnabled,
      vlanCapable: correspondenceData.switch.vlanCapable,
      ports: correspondenceData.switch.ports.map(({ enabled, pvid, vid, interface: intfc }) => ({
        enabled,
        pvid,
        vid,
        interface: {
          description: intfc.description,
          mac: intfc.mac,
          name: intfc.name,
          displayName: toApiInterfaceDisplayName(intfc),
          position: intfc.position,
          type: intfc.type,
        },
      })),
    };
  })(),
  vlan: (() => {
    if (isNull(correspondenceData.vlan)) { return null }

    return {
      id: correspondenceData.vlan.id,
      interface: {
        position: correspondenceData.vlan.interface.position,
        name: correspondenceData.vlan.interface.name,
        type: correspondenceData.vlan.interface.type,
        description: correspondenceData.vlan.interface.description,
        displayName: toApiInterfaceDisplayName(correspondenceData.vlan.interface),
        mac: correspondenceData.vlan.interface.mac,
      },
    };
  })(),
  pppoe: (() => {
    if (isNull(correspondenceData.pppoe)) { return null }

    return {
      id: correspondenceData.pppoe.id,
      interface: {
        position: correspondenceData.pppoe.interface.position,
        name: correspondenceData.pppoe.interface.name,
        type: correspondenceData.pppoe.interface.type,
        description: correspondenceData.pppoe.interface.description,
        displayName: toApiInterfaceDisplayName(correspondenceData.pppoe.interface),
        mac: correspondenceData.pppoe.interface.mac,
      },
      account: correspondenceData.pppoe.account,
      password: correspondenceData.pppoe.password,
    };
  })(),
  pon: (() => {
    if (isNull(correspondenceData.pon)) { return null }

    return {
      authentication: {
        authorizationType: correspondenceData.pon.authentication.authorizationType,
        preSharedSecret: correspondenceData.pon.authentication.preSharedSecret,
      },
    };
  })(),
  bridge: (() => {
    if (isNull(correspondenceData.bridge)) { return null }

    return {
      priority: correspondenceData.bridge.priority,
      forwardingDelay: correspondenceData.bridge.forwardingDelay,
      helloTime: correspondenceData.bridge.helloTime,
      maxAge: correspondenceData.bridge.maxAge,
      stp: correspondenceData.bridge.stp,
      ports: correspondenceData.bridge.ports.map(port => ({
        enabled: port.enabled,
        interface: {
          displayName: toApiInterfaceDisplayName(port.interface),
          description: port.interface.description,
          name: port.interface.name,
          mac: port.interface.mac,
          position: port.interface.position,
          type: port.interface.type,
        },
      })),
    };
  })(),
  poe: {
    output: correspondenceData.poe.output,
    capacities: correspondenceData.poe.capacities,
  },
  enabled: correspondenceData.enabled,
});

// toDbInterface :: InterfaceCorrespondenceData -> DbInterface
//     InterfaceCorrespondenceData = Object
//     DbInterface = Object
const toDbInterface = correspondenceData => ({
  identification: {
    position: correspondenceData.identification.position,
    name: correspondenceData.identification.name,
    type: correspondenceData.identification.type,
    description: correspondenceData.identification.description,
    mac: correspondenceData.identification.mac,
  },
  mtu: correspondenceData.mtu,
  poe: (() => {
    if (isNull(correspondenceData.poe)) { return null }

    return {
      output: correspondenceData.poe.output,
      capacities: correspondenceData.poe.capacities,
    };
  })(),
  proxyARP: correspondenceData.proxyARP,
  vif: correspondenceData.vif,
  speed: correspondenceData.speed,
  status: {
    description: correspondenceData.status.description,
    plugged: correspondenceData.status.plugged,
    speed: correspondenceData.status.speed,
    duplex: correspondenceData.status.duplex,
    sfp: correspondenceData.status.sfp,
  },
  addresses: (() => {
    if (!Array.isArray(correspondenceData.addresses)) { return [] }

    return correspondenceData.addresses.map(pick(['type', 'cidr']));
  })(),
  statistics: (() => {
    if (isNull(correspondenceData.statistics)) { return null }

    return {
      timestamp: correspondenceData.statistics.timestamp,
      rxrate: correspondenceData.statistics.rxrate,
      txrate: correspondenceData.statistics.txrate,
      dropped: correspondenceData.statistics.dropped,
      errors: correspondenceData.statistics.errors,
      rxbytes: correspondenceData.statistics.rxbytes,
      txbytes: correspondenceData.statistics.txbytes,
      previousTxbytes: correspondenceData.statistics.previousTxbytes,
      previousRxbytes: correspondenceData.statistics.previousRxbytes,
      previousDropped: correspondenceData.statistics.previousDropped,
      previousErrors: correspondenceData.statistics.previousErrors,
    };
  })(),
  ponAuthentication: (() => {
    if (pathSatisfies(isNil, ['pon', 'authentication'], correspondenceData)) { return null }

    return {
      authorizationType: correspondenceData.pon.authentication.authorizationType,
      logicalPassword: correspondenceData.pon.authentication.preSharedSecret,
      logicalID: correspondenceData.pon.authentication.logicalId,
    };
  })(),
  ponStatistics: (() => {
    if (pathSatisfies(isNil, ['pon', 'statistics'], correspondenceData)) { return null }

    return {
      registrationStatus: correspondenceData.pon.statistics.registrationStatus,
      transmitPower: correspondenceData.pon.statistics.transmitPower,
      receivePower: correspondenceData.pon.statistics.receivePower,
      biasCurrent: correspondenceData.pon.statistics.biasCurrent,
      distance: correspondenceData.pon.statistics.distance,
    };
  })(),
  enabled: correspondenceData.enabled,
  switch: correspondenceData.switch,
  vlan: (() => {
    if (isNull(correspondenceData.vlan)) { return null }

    return {
      id: correspondenceData.vlan.id,
      interface: {
        position: correspondenceData.vlan.interface.position,
        name: correspondenceData.vlan.interface.name,
        type: correspondenceData.vlan.interface.type,
        description: correspondenceData.vlan.interface.description,
        mac: correspondenceData.vlan.interface.mac,
      },
    };
  })(),
  pppoe: (() => {
    if (isNull(correspondenceData.pppoe)) { return null }

    return {
      id: correspondenceData.pppoe.id,
      interface: {
        position: correspondenceData.pppoe.interface.position,
        name: correspondenceData.pppoe.interface.name,
        type: correspondenceData.pppoe.interface.type,
        description: correspondenceData.pppoe.interface.description,
        mac: correspondenceData.pppoe.interface.mac,
      },
      account: correspondenceData.pppoe.account,
      password: correspondenceData.pppoe.password,
      defaultRoute: correspondenceData.pppoe.defaultRoute,
      nameServer: correspondenceData.pppoe.nameServer,
    };
  })(),
  bridge: (() => {
    if (isNull(correspondenceData.bridge)) { return null }

    return {
      aging: correspondenceData.bridge.aging,
      conntrack: correspondenceData.bridge.conntrack,
      forwardingDelay: correspondenceData.bridge.forwardingDelay,
      helloTime: correspondenceData.bridge.helloTime,
      maxAge: correspondenceData.bridge.maxAge,
      priority: correspondenceData.bridge.priority,
      promiscuous: correspondenceData.bridge.promiscuous,
      stp: correspondenceData.bridge.stp,
      ports: correspondenceData.bridge.ports,
    };
  })(),
  ospf: (() => {
    if (isNull(correspondenceData.ospf)) { return null }

    return {
      ospfCapable: correspondenceData.ospf.ospfCapable,
      ospfConfig: correspondenceData.ospf.ospfConfig,
    };
  })(),
});

// toDbInterfaceList :: Array.<InterfaceCorrespondenceData> -> Array.<DbInterface>
const toDbInterfaceList = map(toDbInterface);


module.exports = {
  toApiInterfaceDisplayName,
  toApiInterfaceVisible,
  toApiInterfaceCanDisplayStatistics,
  toApiInterfaceStatus,
  toApiInterfaceOverview,
  toApiInterfaceOverviewList,
  toApiInterfaceConfig,
  toDbInterface,
  toDbInterfaceList,

  safeToApiInterfaceOverview: liftMapper(toApiInterfaceOverview),
  safeToApiInterfaceOverviewList: liftMapper(toApiInterfaceOverviewList),
  safeToApiInterfaceConfig: liftMapper(toApiInterfaceConfig),
  safeToDbInterface: liftMapper(toDbInterface),
  safeToDbInterfaceList: liftMapper(toDbInterfaceList),
};
