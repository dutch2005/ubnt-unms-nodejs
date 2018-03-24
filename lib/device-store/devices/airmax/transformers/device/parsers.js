'use strict';

const { match, when, pathOr, any, map, filter, equals, length } = require('ramda');
const { getOr, __, flow, nth, lt, eq, constant, clamp, floor, get, toInteger, parseInt, isNull } = require('lodash/fp');
const ip = require('ip');
const htmlEntities = require('html-entities').Html5Entities;

const { StatusEnum, DeviceTypeEnum, DeviceCategoryEnum } = require('../../../../../enums');
const { isDeviceModelSupported } = require('../../../../../feature-detection/common');
const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');
const { parseDeviceDescription } = require('../../../../../transformers/device/model/parsers');
const { roundTo } = require('../../../../../util');

// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = flow(match(/^(\w+)\./), nth(1));

// parseHwDeviceName :: HwStatus -> DeviceName
//     HwStatus = Object
//     DeviceName = String
const parseHwDeviceName = flow(
  getOr('', ['data', 'host', 'hostname']),
  htmlEntities.decode
);

// parseHwFirmwareVersion :: HwStatus -> FirmwareVersion
//     HwStatus = Object
//     FirmwareVersion = String
const parseHwFirmwareVersion = flow(
  getOr(null, ['data', 'host', 'fwversion']),
  parseCommFirmwareVersion
);

// parseHwPlatformId :: HwDevice -> PlatformId
//     HwDevice = Object
//     PlatformId = String
const parseHwPlatformId = flow(
  getOr('', ['firmware', 'version']),
  parsePlatformId
);

// parseHwAntenna :: HwBoardInfo -> String|Null
const parseHwAntenna = (hwDevice) => {
  const radio = 1;
  const antennaId = get(['configuration', `radio.${radio}.antenna.id`], hwDevice);

  return getOr(null, ['board', `radio.${radio}.antenna.${antennaId}.name`], hwDevice);
};

// parseHwModel :: HwStatus -> Number
//     HwStatus = Object
const parseHwModel = ({ hwStatus }, hwDeviceConfig) => {
  const boardModel = getOr(null, ['board.model'], hwDeviceConfig.board);

  if (boardModel !== null && isDeviceModelSupported(boardModel)) {
    return boardModel;
  }

  // some legacy firmwares do not return devmodel in status
  const devModel = getOr(null, ['data', 'host', 'devmodel'], hwStatus);
  if (devModel !== null) {
    const model = parseDeviceDescription(devModel);
    if (isDeviceModelSupported(model)) {
      return model;
    }
  }

  const boardSubtype = getOr(null, ['board.subtype'], hwDeviceConfig.board);
  const boardShortName = getOr(null, ['board.shortname'], hwDeviceConfig.board);
  const boardName = getOr('', ['board.name'], hwDeviceConfig.board);

  if (boardSubtype !== null) {
    if (boardShortName !== null) {
      const model = `${boardShortName}-${boardSubtype}`;
      if (isDeviceModelSupported(model)) { return model }
    }

    const name = `${boardName} ${boardSubtype}`;
    const model = parseDeviceDescription(name);
    if (isDeviceModelSupported(model)) { return model }
  }

  if (boardShortName !== null && isDeviceModelSupported(boardShortName)) {
    return boardShortName;
  }

  const deviceName = `${boardName} ${boardSubtype}`;
  return parseDeviceDescription(deviceName);
};

// parseHwCpuUsage :: HwStatus -> Number
//     HwStatus = Object
const parseHwCpuUsage = flow(getOr(0, ['data', 'host', 'cpuload']), floor, clamp(0, 100));

// parseHwMemoryUsage :: HwStatus -> Number
//     HwStatus = Object
const parseHwMemoryUsage = (hwStatus) => {
  const total = pathOr(null, ['data', 'host', 'totalram'], hwStatus);
  const free = pathOr(null, ['data', 'host', 'freeram'], hwStatus);

  if (any(isNull, [total, free])) { return 0 }

  const used = total - free;

  return floor((used / total) * 100);
};

// parseHwUptime :: HwStatus -> Number
//     HwStatus = Object
const parseHwUptime = getOr(0, ['data', 'host', 'uptime']);

// parseHwPingStatsErrors :: HwPingStats -> Number
//     HwPingStats = Object
const parseHwPingStatsErrors = flow(getOr(0, ['data', 'failureRate']), toInteger);

// parseHwPingStatsLatency :: HwPingStats -> Number
//     HwPingStats = Object
const parseHwPingStatsLatency = (hwPingStats) => {
  const errors = parseHwPingStatsErrors(hwPingStats);

  if (errors > 0) { return null }

  return flow(getOr(0, ['data', 'latency']), roundTo(3))(hwPingStats);
};

// parseHwSSID :: HwStatus -> String|Null
//     HwStatus = Object
const parseHwSSID = getOr(null, ['data', 'wireless', 'essid']);

// parseHwFrequency :: HwStatus -> Number
//     HwStatus = Object
const parseHwFrequency = flow(getOr(0, ['data', 'wireless', 'frequency']), parseInt(10));

// parseHwSecurity :: HwStatus -> String|Null
//     HwStatus = Object
const parseHwSecurity = getOr(null, ['data', 'wireless', 'security']);

// parses wireless distance in meters
// parseHwDistance :: HwStatus -> Number
//     HwStatus = Object
const parseHwDistance = flow(
  getOr(0, ['data', 'wireless', 'distance']),
  when(lt(__, 150), constant(150)),
  when(eq(100000), constant(0))
);

// parseHwNetworkMode :: HwStatus -> String
const parseHwNetworkMode = get(['data', 'host', 'netrole']);

const parseHwIpAddress = (hwDeviceConfig) => {
  const address = getOr('', ['ip', 'addr'], hwDeviceConfig);
  const mask = getOr('', ['ip', 'mask'], hwDeviceConfig);

  if (ip.isV4Format(address) && ip.isV4Format(mask)) {
    const subnet = ip.subnet(address, mask);
    return `${address}/${subnet.subnetMaskLength}`;
  }

  return null;
};

/**
 * @param {Object} auxiliaries
 * @param {Object} hwDeviceConfig
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwDeviceConfig = (auxiliaries, hwDeviceConfig) => ({
  identification: {
    platformId: parseHwPlatformId(hwDeviceConfig.data),
    ipAddress: parseHwIpAddress(hwDeviceConfig.data),
  },
  airmax: {
    antenna: parseHwAntenna(hwDeviceConfig.data),
  },
});

// parseHwChainMaskToChains :: String -> Number
const parseHwChainMaskToChains = flow(
  parseInt(10),
  m => m.toString(2),
  map(filter(equals(1))),
  length
);

/**
 * @param {CorrespondenceSysInfo} sysInfo
 * @return {CorrespondenceDevice}
 */
const airMaxDeviceStub = sysInfo => ({
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
    type: DeviceTypeEnum.AirMax,
    category: DeviceCategoryEnum.Wireless,
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
  onu: null,
  olt: null,
  aircube: null,
  airmax: {
    series: null,
    ssid: null,
    frequency: null,
    frequencyBands: null,
    frequencyCenter: null,
    security: null,
    channelWidth: null,
    antenna: null,
    noiseFloor: null,
    ccq: null,
    stationsCount: null,
    wirelessMode: null,
    remoteSignal: null,
    lanStatus: null,
    transmitChains: null,
    receiveChains: null,
    apMac: null,
    wlanMac: null,
    polling: {
      enabled: true,
    },
  },
  interfaces: [],
  unmsSettings: null,
});

module.exports = {
  airMaxDeviceStub,
  parseHwDeviceConfig,
  parsePlatformId,
  parseHwDeviceName,
  parseHwFirmwareVersion,
  parseHwPlatformId,
  parseHwModel,
  parseHwCpuUsage,
  parseHwMemoryUsage,
  parseHwUptime,
  parseHwPingStatsErrors,
  parseHwPingStatsLatency,
  parseHwSSID,
  parseHwFrequency,
  parseHwSecurity,
  parseHwDistance,
  parseHwNetworkMode,
  parseHwIpAddress,
  parseHwChainMaskToChains,
};
