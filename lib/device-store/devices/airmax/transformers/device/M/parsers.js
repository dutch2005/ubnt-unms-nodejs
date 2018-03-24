'use strict';

const { isNotNull, isUndefined, isNotNumber } = require('ramda-adjunct');
const { lensProp, over, flip, divide, multiply, find, pathEq, when, always } = require('ramda');
const { getOr, flow, pickBy, size, round } = require('lodash/fp');

const { roundTo } = require('../../../../../../util');
const { WirelessModeEnum } = require('../../../../../../enums');
const { parseHwInterfaceStatistics, parseHwInterfaceList } = require('../../interfaces/parsers');
const {
  parseHwDeviceName, parseHwFirmwareVersion, parseHwCpuUsage, parseHwMemoryUsage,
  parseHwUptime, parseHwPingStatsLatency, parseHwPingStatsErrors, parseHwSSID, parseHwFrequency,
  parseHwSecurity, parseHwDistance, parseHwNetworkMode,
} = require('../parsers');

// parseHwStationListCount :: HwStationList -> Number
const parseHwStationListCount = size;

// parseHwSignal :: HwStationList -> Number|Null
//     HwStationList = Object
const parseHwSignal = flow(
  when(
    (stationList => stationList.length === 1),
    getOr(null, [0, 'signal'])
  ),
  when(isNotNumber, always(null)),
  when(isNotNull, round)
);

// parseHwRemoteSignal :: HwStationList -> Number|Null
//     HwStationList = Object
const parseHwRemoteSignal = flow(
  when(
    (stationList => stationList.length === 1),
    getOr(null, [0, 'remote', 'signal'])
  ),
  when(isNotNumber, always(null)),
  when(isNotNull, round)
);

// parseHwChannelWidth :: HwStatus -> Number
//     HwStatus = Object
const parseHwChannelWidth = getOr(0, ['data', 'wireless', 'chanbw']);

// parseHwCCQ :: HwStatus -> Number
//     HwStatus = Object
const parseHwCCQ = getOr(0, ['data', 'wireless', 'ccq']);

// parseHwCCQInPercent :: HwStatus -> Percent
//     HwStatus = Object
//     Percent = Number<0, 100>
const parseHwCCQInPercent = flow(parseHwCCQ, flip(divide)(1000), multiply(100), roundTo(2));

// parseHwPollingEnabled :: HwStatus -> Boolean
//     HwStatus = Object
const parseHwPollingEnabled = flow(getOr(false, ['data', 'wireless', 'polling', 'enabled']), Boolean);

// parseHwWirelessMode :: HwStatus -> Mode
//     HwStatus = Object
//     Mode = String
const parseHwWirelessMode = (hwStatus) => {
  const mode = getOr(null, ['data', 'wireless', 'mode'], hwStatus);
  const apRepeaterEnabled = getOr(null, ['data', 'wireless', 'aprepeater'], hwStatus);

  if (apRepeaterEnabled) { return WirelessModeEnum.ApRep }

  return mode;
};

// parseHwLanStatus :: HwStatus -> CmLanStatus
//     HwStatus = Object
//     CmLanStatus = Object
const parseHwLanStatus = (hwStatus) => {
  const cmInterfaceList = parseHwInterfaceList({}, hwStatus);
  const eth0 = find(pathEq(['identification', 'name'], 'eth0'), cmInterfaceList);
  const eth1 = find(pathEq(['identification', 'name'], 'eth1'), cmInterfaceList);

  return {
    eth0: (() => {
      if (isUndefined(eth0)) { return null }

      return {
        description: eth0.status.description,
        plugged: eth0.status.plugged,
        speed: eth0.status.speed,
        duplex: eth0.status.duplex,
      };
    })(),
    eth1: (() => {
      if (isUndefined(eth1)) { return null }

      return {
        description: eth1.status.description,
        plugged: eth1.status.plugged,
        speed: eth1.status.speed,
        duplex: eth1.status.duplex,
      };
    })(),
  };
};

// parseHwDeviceStatistics :: (Auxiliaries, HwStatus) -> CorrespondenceStatistics
//     Auxiliaries = {hwPingStats: HwPingStats, hwStationList: HwStationList}
//     HwStatus = Object
//     CorrespondenceStatistics = Object
const parseHwDeviceStatistics = ({ currentTimestamp = Date.now() }, { hwStatus, hwStationList, hwPingStats }) => {
  const cmStatistics = {
    timestamp: currentTimestamp,
    weight: 1,
    interfaces: parseHwInterfaceStatistics(hwStatus),
    stats: {
      signal: parseHwSignal(hwStationList),
      remoteSignal: parseHwRemoteSignal(hwStationList),
      ping: parseHwPingStatsLatency(hwPingStats),
      errors: parseHwPingStatsErrors(hwPingStats),
      ram: parseHwMemoryUsage(hwStatus),
      cpu: parseHwCpuUsage(hwStatus),
    },
  };

  // collect metrics only when it makes sense and at least one station device is connected
  return over(lensProp('stats'), pickBy(isNotNull), cmStatistics);
};

// parses AirMax comm device into correspondence form
// parseCommDevice :: (Auxiliaries, Object) -> CorrespondenceData
//     Auxiliaries = {hwStatus: Object, hwFirmwareVersion: Object, hwInterfaceListStatus: Object, hwStationList: Object}
//     CorrespondenceData = Object
const parseHwStatus = ({ currentTimestamp = Date.now() }, { hwStatus, hwStationList }) => ({
  identification: {
    name: parseHwDeviceName(hwStatus),
    firmwareVersion: parseHwFirmwareVersion(hwStatus),
    updated: currentTimestamp,
  },
  overview: {
    cpu: parseHwCpuUsage(hwStatus),
    ram: parseHwMemoryUsage(hwStatus),
    signal: parseHwSignal(hwStationList),
    distance: parseHwDistance(hwStatus),
    lastSeen: currentTimestamp,
    uptime: parseHwUptime(hwStatus),
  },
  mode: parseHwNetworkMode(hwStatus),
  airmax: {
    ssid: parseHwSSID(hwStatus),
    antenna: getOr(null, ['data', 'wireless', 'antenna'], hwStatus),
    frequency: parseHwFrequency(hwStatus),
    security: parseHwSecurity(hwStatus),
    channelWidth: parseHwChannelWidth(hwStatus),
    ccq: parseHwCCQInPercent(hwStatus),
    stationsCount: parseHwStationListCount(hwStationList),
    wirelessMode: parseHwWirelessMode(hwStatus),
    remoteSignal: parseHwRemoteSignal(hwStationList),
    lanStatus: parseHwLanStatus(hwStatus),
    polling: {
      enabled: parseHwPollingEnabled(hwStatus),
    },
  },
  interfaces: parseHwInterfaceList({ currentTimestamp }, hwStatus),
});

module.exports = {
  parseHwStatus,
  parseHwDeviceStatistics,
};
