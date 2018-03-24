'use strict';

const { mapValues } = require('lodash/fp');
const {
  pipe, pathOr, slice, when, equals, anyPass, test, ifElse, always, map, toPairs, reject, trim, pathEq, nthArg, pickBy,
} = require('ramda');
const { isNotNull, isNotNil } = require('ramda-adjunct');

const { InterfaceIdentificationTypeEnum, PoeOutputEnum } = require('../../../../../enums');

const isEthernetInterfaceType = anyPass([
  test(/^wan/i),
  test(/^eth/i),
  test(/^lan/i),
]);

const isWifiInterfaceType = test(/^wlan\d+/);

const isBridgeInterfaceType = test(/^br/);

const interfaceNameToType = (interfaceName) => {
  if (isEthernetInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Ethernet;
  } else if (isBridgeInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Bridge;
  } else if (isWifiInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Wifi;
  }
  return null;
};

/**
 * @function
 * @param {Object} hwInterface
 * @param {Object} hwInterfaceName
 * @return {boolean}
 */
const isMeasurableInterface = pipe(
  nthArg(1),
  anyPass([isBridgeInterfaceType, isEthernetInterfaceType, isWifiInterfaceType])
);

const parseHwInterfaceDuplex = pipe(
  pathOr(null, ['speed']),
  when(isNotNull, pipe(slice(-1, Infinity), equals('F')))
);

// parseHwInterface :: [HwInterfaceName, HwInterface] -> CmInterface
//    HwInterfaceName = String
//    HwInterface = Object
//    CmInterface = Object
const parseHwInterface = ([hwIntfcName, hwInterface]) => ({
  identification: {
    position: null,
    type: interfaceNameToType(hwIntfcName),
    name: hwIntfcName,
    description: null,
    mac: hwInterface.macaddr,
  },
  statistics: {
    timestamp: Date.now(),
    rxrate: pathOr(0, ['statistics', 'custom_rx_throughput'], hwInterface),
    rxbytes: pathOr(0, ['statistics', 'rx_bytes'], hwInterface),
    txrate: pathOr(0, ['statistics', 'custom_tx_throughput'], hwInterface),
    txbytes: pathOr(0, ['statistics', 'tx_bytes'], hwInterface),
    dropped: pathOr(0, ['statistics', 'tx_dropped'], hwInterface),
    errors: pathOr(0, ['statistics', 'tx_errors'], hwInterface),
    previousTxbytes: 0,
    previousRxbytes: 0,
    previousDropped: 0,
    previousErrors: 0,
  },
  addresses: [],
  mtu: hwInterface.mtu,
  poe: ifElse(
    equals('wan0'),
    always([PoeOutputEnum.PASSTHROUGH]),
    always(null)
  )(hwIntfcName),
  enabled: hwInterface.up,
  proxyARP: null,
  switch: null,
  bridgeGroup: null,
  onSwitch: false, // TODO(michal.sedlak@ubnt.com): parse correct values if possible
  isSwitchedPort: false,
  status: {
    autoneg: false,
    duplex: parseHwInterfaceDuplex(hwInterface),
    speed: ifElse(
      isNotNil,
      pipe(trim, slice(0, -1), Number),
      always(null)
    )(hwInterface.speed),
    description: null,
    plugged: null,
    sfp: null,
  },
  vlan: null,
  pppoe: null,
  pon: null,
  bridge: null,
  ospf: {
    ospfCapable: false,
    ospfConfig: null,
  },
});

// parseHwInterface :: (Auxiliaries, HwInterface) -> CmInterface[]
//    Auxiliaries = Object
//    HwInterface = Object
//    CmInterface = Object
const parseHwInterfacesList = (auxiliaries, hwInterfaceList) => pipe(
  toPairs,
  map(parseHwInterface),
  reject(pathEq(['identification', 'name'], 'lo'))
)(hwInterfaceList);

// extractInterfaceStatistics :: (HwInterface) -> CorrespondenceStatistics
//     Auxiliaries = Object
//     HwInterface = Object
//     CorrespondenceStatistics = Object
const extractInterfaceStatistics = hwInterface => ({
  weight: 1,
  stats: {
    rx_bps: pathOr(0, ['statistics', 'custom_tx_throughput'], hwInterface),
    tx_bps: pathOr(0, ['statistics', 'custom_rx_throughput'], hwInterface),
  },
});

/**
 * @function
 * @param {Object} hwStatus
 * @return {Object}
 */
const parseHwInterfaceStatistics = pipe(
  pickBy(isMeasurableInterface),
  mapValues(extractInterfaceStatistics)
);

module.exports = {
  parseHwInterfacesList,
  parseHwInterfaceStatistics,
};
