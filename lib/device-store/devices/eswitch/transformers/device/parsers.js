'use strict';

const { flow, getOr, trim, floor, clamp, toInteger, defaultTo, replace } = require('lodash/fp');
const { split, toLower, fromPairs, map } = require('ramda');
const ip = require('ip');

const { StatusEnum } = require('../../../../../enums');
const { roundTo } = require('../../../../../util');
const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');
const { deviceTypeFromModel, deviceCategoryFromType } = require('../../../../../feature-detection/common');

// parseHwDeviceName :: HwSysInfo -> DeviceName
//     HwSysInfo = Object
//     DeviceName = String
const parseHwDeviceName = flow(getOr(null, ['data', 'config', 'hostname']), defaultTo('ubnt'), trim);

// parseHwFirmwareVersion :: String -> FirmwareVersion
//     FirmwareVersion = String
const parseHwFirmwareVersion = flow(
  String,
  parseCommFirmwareVersion
);

const parseHwIpAddress = (hwDeviceIp) => {
  const ipAddr = flow(
    toLower,
    split(','),
    map(flow(trim, split(':'))),
    fromPairs
  )(hwDeviceIp);

  const address = getOr('', ['addr'], ipAddr);
  const mask = getOr('', ['mask'], ipAddr);

  if (ip.isV4Format(address) && ip.isV4Format(mask)) {
    const subnet = ip.subnet(address, mask);
    return `${address}/${subnet.subnetMaskLength}`;
  }

  return null;
};

// parseHwCpuUsage :: HwSystemStats -> Number
//     HwStatus = Object
const parseHwCpuUsage = flow(getOr(0, ['cpu']), floor, clamp(0, 100));

// parseHwMemoryUsage :: HwSystemStats -> Number
//     HwStatus = Object
const parseHwMemoryUsage = flow(getOr(0, ['mem']), floor, clamp(0, 100));

// parseHwUptime :: HwSystemStats -> Number
//     HwStatus = Object
const parseHwUptime = flow(getOr(0, ['uptime']), toInteger);

// parseHwPingStatsErrors :: HwSystemStats -> Number
//     HwPingStats = Object
const parseHwPingStatsErrors = flow(getOr(0, ['ping', 'failureRate']), toInteger);

// parseHwPingStatsLatency :: HwSystemStats -> Number
//     HwPingStats = Object
const parseHwPingStatsLatency = flow(getOr(0, ['ping', 'latency']), roundTo(3));

// parseHwConfig :: (Auxiliaries, Object) -> CorrespondenceData
//     Auxiliaries = {currentTimestamp: number}
//     CorrespondenceData = Object
const parseHwConfig = ({ currentTimestamp = Date.now() }, hwConfig) => ({
  identification: {
    name: parseHwDeviceName(hwConfig),
    firmwareVersion: parseHwFirmwareVersion(getOr(null, ['data', 'config', 'version'], hwConfig)),
    updated: currentTimestamp,
    ipAddress: parseHwIpAddress(getOr('', ['data', 'config', 'network'], hwConfig)),
  },
  overview: {
    lastSeen: currentTimestamp,
  },
});

const parseHwDeviceIp = ({ currentTimestamp = Date.now() }, hwDeviceIp) => ({
  identification: {
    updated: currentTimestamp,
    ipAddress: parseHwIpAddress(hwDeviceIp.data),
  },
  overview: {
    lastSeen: currentTimestamp,
  },
});

const parseHwSysInfo = ({ currentTimestamp = Date.now() }, hwSysInfo) => ({
  identification: {
    name: defaultTo('ubnt', hwSysInfo.data.hostname),
    firmwareVersion: parseHwFirmwareVersion(replace(/\.\d+$/, '', hwSysInfo.data.version)), // trim build number
    updated: currentTimestamp,
  },
  overview: {
    lastSeen: currentTimestamp,
  },
});

// parseHwDeviceStatistics :: (Auxiliaries, HwSystemStats) -> CorrespondenceStatistics
//     Auxiliaries = Object
//     HwSystemStats = Object
//     CorrespondenceStatistics = Object
const parseHwDeviceStatistics = ({ currentTimestamp = Date.now() }, hwSystemStats) => ({
  timestamp: currentTimestamp,
  weight: 1,
  interfaces: {},
  stats: {
    ping: parseHwPingStatsLatency(hwSystemStats),
    errors: parseHwPingStatsErrors(hwSystemStats),
    cpu: parseHwCpuUsage(hwSystemStats),
    ram: parseHwMemoryUsage(hwSystemStats),
  },
});

// parseHwSystemStats :: (Auxiliaries, HwSystemStats) -> CorrespondenceOverview
//     Auxiliaries = Object
//     HwSystemStats = Object
//     CorrespondenceOverview = Object
const parseHwSystemStats = ({ currentTimestamp = Date.now() }, hwSystemStats) => ({
  overview: {
    cpu: parseHwCpuUsage(hwSystemStats),
    ram: parseHwMemoryUsage(hwSystemStats),
    lastSeen: currentTimestamp,
    uptime: parseHwUptime(hwSystemStats),
  },
});


/**
 * @param {CorrespondenceSysInfo} sysInfo
 * @return {CorrespondenceDevice}
 */
const eswitchDeviceStub = (sysInfo) => {
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
    interfaces: [],
    unmsSettings: null,
  };
};

module.exports = {
  eswitchDeviceStub,
  parseHwConfig,
  parseHwSysInfo,
  parseHwDeviceIp,
  parseHwDeviceStatistics,
  parseHwSystemStats,
};
