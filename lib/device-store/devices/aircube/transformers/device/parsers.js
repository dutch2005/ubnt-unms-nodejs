'use strict';

const { flow, getOr, floor, toInteger, get, clamp, partial } = require('lodash/fp');
const {
  pipe, pathOr, prop, when, ifElse, always, applySpec, find, pathEq, assocPath, curry, lte, equals,
} = require('ramda');
const { isNotNull, stubNull } = require('ramda-adjunct');

const { parseHwInterfacesList, parseHwInterfaceStatistics } = require('../interfaces/parsers');
const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');
const {
  StatusEnum, OnuModeEnum, WirelessModeEnum, WifiSecurityEnum, WifiAuthenticationEnum, AirCubeTxPowerEnum,
} = require('../../../../../enums');
const { deviceTypeFromModel, deviceCategoryFromType } = require('../../../../../feature-detection/common');

// parseHwDeviceName :: HwSystemBoard -> String
//     HwConfigSystem = Object
const parseHwDeviceName = getOr('airCube', ['hostname']);

// parseHwFirmwareVersion :: HwSystemBoard -> FirmwareVersion
//     HwSystemBoard = Object
//     FirmwareVersion = String
const parseHwFirmwareVersion = flow(
  getOr(null, ['release', 'version']),
  parseCommFirmwareVersion
);

// parseHwMemoryUsage :: Object -> Number
const parseHwMemoryUsage = (hwSystemInfo) => {
  const total = parseInt(hwSystemInfo.memory.total, 10);
  const free = parseInt(hwSystemInfo.memory.free, 10);
  const used = total - free;

  return floor((used / total) * 100);
};

// parseHwUptime :: HwSystemInfo -> Number
//     HwSystemInfo = Object
const parseHwPingStatsLatency = flow(get(['data', 'latency']), toInteger);

// parseHwUptime :: HwSystemInfo -> Number
//     HwSystemInfo = Object
const parseHwPingStatsErrors = flow(get(['data', 'failparseHwInterfaceStatisticsureRate']), toInteger);

// parseHwUptime :: HwSystemInfo -> Number
//     HwSystemInfo = Object
const parseHwUptime = flow(get(['uptime']), toInteger);

// parseHwCpuUsage :: HwSystemInfo -> Number
//     HwSystemInfo = Object
const parseHwCpuUsage = flow(getOr(0, ['cpu']), toInteger, clamp(0, 100));

/**
 * @function parseHwSystemBoard
 * @param {number} currentTimestamp
 * @param {Object} hwSystemBoard
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwSystemBoard = ({ currentTimestamp = Date.now() }, hwSystemBoard) => ({
  identification: {
    name: parseHwDeviceName(hwSystemBoard),
    serialNumber: null,
    firmwareVersion: parseHwFirmwareVersion(hwSystemBoard),
    updated: currentTimestamp,
  },
  overview: {
    lastSeen: currentTimestamp,
  },
});

/**
 * @function parseHwSystemInfo
 * @param {number} currentTimestamp
 * @param {Object} hwSystemInfo
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwSystemInfo = ({ currentTimestamp = Date.now() }, hwSystemInfo) => ({
  overview: {
    cpu: parseHwCpuUsage(hwSystemInfo),
    ram: parseHwMemoryUsage(hwSystemInfo),
    lastSeen: currentTimestamp,
    uptime: parseHwUptime(hwSystemInfo),
  },
});

/**
 * @function parseHwIpGateway
 * @param {Object} interfaces
 * @param {Object} interfaces.hwWanInterface
 * @param {Object} interfaces.hwLanInterface
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwIpGateway = pipe(
  ifElse(
    pipe(prop('hwWanInterface'), pathEq(['up'], true)),
    prop('hwWanInterface'),
    prop('hwLanInterface')
  ),
  applySpec({
    overview: {
      gateway: pipe(pathOr([], ['route']), find(pathEq(['target'], '0.0.0.0')), pathOr(null, ['nexthop'])),
    },
    identification: {
      ipAddress: pipe(
        pathOr(null, ['ipv4-address', 0]),
        when(equals('0.0.0.0'), stubNull),
        when(isNotNull, ip => `${ip.address}/${ip.mask}`)
      ),
    },
  })
);

/**
 * @function parseHwDeviceInterfaces
 * @param {Object} hwInterfaceList
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwDeviceInterfaces = applySpec({
  interfaces: partial(parseHwInterfacesList, [{}]),
});

/**
 * @function parseHwMode
 * @param {Object} hwWanInterface
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwMode = applySpec({
  mode: ifElse(
    pathEq(['up'], true),
    always(OnuModeEnum.Router),
    always(OnuModeEnum.Bridge)
  ),
});

const parseHwTxPower = (txPower) => {
  if (lte(txPower, AirCubeTxPowerEnum.Low)) {
    return AirCubeTxPowerEnum.Low;
  }

  if (lte(txPower, AirCubeTxPowerEnum.Medium)) {
    return AirCubeTxPowerEnum.Medium;
  }

  return AirCubeTxPowerEnum.High;
};

/**
 * @function parseHwDeviceStatistics
 * @param {number} currentTimestamp
 * @param {Object} hwSystemInfo
 * @param {Object} hwInterfaceList
 * @param {Object} hwPingStats
 * @return {CorrespondenceStatistics}
 */
const parseHwDeviceStatistics = (
  { currentTimestamp = Date.now() },
  { hwSystemInfo, hwInterfaceList, hwPingStats }
) => ({
  timestamp: currentTimestamp,
  weight: 1,
  interfaces: parseHwInterfaceStatistics(hwInterfaceList),
  stats: {
    ping: parseHwPingStatsLatency(hwPingStats),
    errors: parseHwPingStatsErrors(hwPingStats),
    cpu: parseHwCpuUsage(hwSystemInfo),
    ram: parseHwMemoryUsage(hwSystemInfo),
  },
});

const parseHwWlanInterface = curry((interfaceName, hwInterface) => assocPath(['aircube', interfaceName], {
  available: true,
  mode: ifElse(
    pathEq(['mode'], 'Master'),
    always(WirelessModeEnum.Ap),
    always(WirelessModeEnum.Sta)
  )(hwInterface),
  mac: pathOr(null, ['macaddr'], hwInterface),
  ssid: pathOr(null, ['ssid'], hwInterface),
  country: pathOr(null, ['country'], hwInterface),
  channel: pathOr(null, ['channel'], hwInterface),
  frequency: pathOr(null, ['frequency'], hwInterface),
  encryption: ifElse(
    pathOr(false, ['encryption', 'enabled']),
    ifElse(
      pathEq(['encryption', 'wpa', 0], 2),
      always(WifiSecurityEnum.WPA2),
      always(WifiSecurityEnum.WPA)
    ),
    always(null)
  )(hwInterface),
  authentication: ifElse(
    pathOr(false, ['encryption', 'enabled']),
    ifElse(
      pathEq(['encryption', 'authentication', 0], 'psk'),
      always(WifiAuthenticationEnum.PSK),
      always(WifiAuthenticationEnum.Enterprise)
    ),
    always(null)
  )(hwInterface),
  txPower: parseHwTxPower(pathOr(null, ['txpower'], hwInterface)),
}, {}));

const parseHwWanPoe = applySpec({
  aircube: {
    poe: pathEq(['values', 'poe_pass'], '1'),
  },
});

const parseHwWifiMode = (/* { hwSystemInfo, hwInterfaceList } */) => ({
  aircube: {
    wifiMode: WirelessModeEnum.Ap,
  },
});

const airCubeDeviceStub = (sysInfo) => {
  const type = deviceTypeFromModel(sysInfo.model);
  const category = deviceCategoryFromType(type);

  return {
    identification: {
      id: sysInfo.deviceId,
      enabled: true,
      siteId: null,
      site: null,
      mac: sysInfo.mac,
      name: 'ubnt',
      serialNumber: null,
      firmwareVersion: sysInfo.firmwareVersion,
      platformId: sysInfo.platformId,
      model: sysInfo.model,
      updated: 0,
      authorized: false,
      type,
      category,
      ipAddress: null,
    },
    overview: {
      status: StatusEnum.Unauthorized,
      canUpgrade: false,
      isLocating: false,
      cpu: null,
      ram: null,
      voltage: null,
      temperature: null,
      signal: null,
      distance: null,
      biasCurrent: null,
      receivePower: null,
      receiveRate: null,
      receiveBytes: null,
      receiveErrors: null,
      receiveDropped: null,
      transmitPower: null,
      transmitRate: null,
      transmitBytes: null,
      transmitErrors: null,
      transmitDropped: null,
      lastSeen: 0,
      uptime: null,
      gateway: null,
    },
    meta: null,
    firmware: null,
    upgrade: null,
    mode: null,
    olt: null,
    onu: null,
    airmax: null,
    aircube: {
      wifiMode: null,
      poe: null,
      stations: null,
      wifi2Ghz: {
        available: false,
        mode: null,
        mac: null,
        ssid: null,
        country: null,
        channel: null,
        frequency: null,
        encryption: null,
        authentication: null,
        txpower: null,
      },
      wifi5Ghz: {
        available: false,
        mode: null,
        mac: null,
        ssid: null,
        country: null,
        channel: null,
        frequency: null,
        encryption: null,
        authentication: null,
        txpower: null,
      },
    },
    interfaces: [],
    unmsSettings: null,
  };
};

module.exports = {
  parseHwSystemBoard,
  parseHwSystemInfo,
  parseHwDeviceStatistics,
  parseHwIpGateway,
  parseHwMode,
  parseHwDeviceInterfaces,
  parseHwWlanInterface,
  parseHwWanPoe,
  parseHwWifiMode,
  airCubeDeviceStub,
};
