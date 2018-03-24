'use strict';

const { isNull, getOr, map, curry, get, defaultTo, filter, keyBy, mapValues, flow } = require('lodash/fp');
const { anyPass } = require('ramda');

const {
  isEthernetInterfaceType, isLogicalWifiInterfaceType, isBridgeInterfaceType, interfaceNameToPosition,
  interfaceNameToType,
} = require('../utils');

// parseHwInterfacePlugged :: HwInterface -> Boolean
//     HwInterface = Object
const parseHwInterfacePlugged = flow(get(['status', 'plugged']), Boolean);

// parseHwInterfaceDuplex :: HwInterface -> Boolean|Null
const parseHwInterfaceDuplex = (hwInterface) => {
  const plugged = parseHwInterfacePlugged(hwInterface);

  if (!plugged) { return null }

  return Boolean(hwInterface.status.duplex);
};

// parseHwInterfaceStatusDescription :: HwInterface -> String|Null
const parseHwInterfaceStatusDescription = (hwInterface) => {
  const duplex = parseHwInterfaceDuplex(hwInterface);
  const speed = hwInterface.status.speed;

  if (isNull(duplex)) { return speed }

  return `${speed} ${duplex ? 'FDX' : 'HDX'}`;
};

// parseHwInterface :: Object -> HwInterface -> Correspondence
const parseHwInterface = curry(({ currentTimestamp = Date.now() }, hwInterface) => ({
  identification: {
    position: interfaceNameToPosition(hwInterface.ifname),
    type: interfaceNameToType(hwInterface.ifname),
    name: hwInterface.ifname,
    description: null,
    mac: hwInterface.hwaddr,
  },
  statistics: {
    timestamp: currentTimestamp,
    rxrate: defaultTo(0, hwInterface.status.rxrate),
    rxbytes: defaultTo(0, hwInterface.status.rx_bytes),
    txrate: defaultTo(0, hwInterface.status.txrate),
    txbytes: defaultTo(0, hwInterface.status.tx_bytes),
    dropped: 0,
    errors: defaultTo(0, hwInterface.status.tx_errors + hwInterface.status.rx_errors),
    previousTxbytes: 0,
    previousRxbytes: 0,
    previousDropped: 0,
    previousErrors: 0,
  },
  addresses: [],
  mtu: hwInterface.mtu,
  poe: null,
  enabled: hwInterface.enabled,
  proxyARP: null,
  switch: null,
  speed: null,
  bridgeGroup: null,
  onSwitch: false, // TODO(michal.sedlak@ubnt.com): parse correct values if possible
  isSwitchedPort: false,
  status: {
    autoneg: false,
    duplex: parseHwInterfaceDuplex(hwInterface),
    description: parseHwInterfaceStatusDescription(hwInterface),
    plugged: parseHwInterfacePlugged(hwInterface),
    speed: hwInterface.status.speed,
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
}));

// parseHwInterfaceList :: (Object, HwStatus) -> Array.<Correspondence>
const parseHwInterfaceList = (auxiliaries, hwStatus) => {
  const hwInterfaces = getOr([], ['data', 'interfaces'], hwStatus);

  return map(parseHwInterface(auxiliaries), hwInterfaces);
};

// extractInterfaceStatistics :: (HwInterface) -> CorrespondenceStatistics
//     Auxiliaries = Object
//     HwInterface = Object
//     CorrespondenceStatistics = Object
const extractInterfaceStatistics = hwInterface => ({
  weight: 1,
  stats: {
    rx_bps: hwInterface.status.rxrate,
    tx_bps: hwInterface.status.txrate,
  },
});

/**
 * @function
 * @param {Object} hwInterface
 * @return {boolean}
 */
const isMeasurableInterface = flow(
  getOr(null, 'ifname'),
  interfaceNameToType,
  anyPass([isBridgeInterfaceType, isEthernetInterfaceType, isLogicalWifiInterfaceType])
);

/**
 * @function
 * @param {Object} hwStatus
 * @return {Object}
 */
const parseHwInterfaceStatistics = flow(
  getOr([], ['data', 'interfaces']),
  filter(isMeasurableInterface),
  keyBy('ifname'),
  mapValues(extractInterfaceStatistics)
);

module.exports = {
  parseHwInterface,
  parseHwInterfaceList,
  parseHwInterfaceStatistics,
};
