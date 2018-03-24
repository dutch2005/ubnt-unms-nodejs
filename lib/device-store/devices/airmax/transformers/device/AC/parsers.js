'use strict';

const { over, lensProp, when, map, pathEq, find, zip, always, filter, uniq } = require('ramda');
const { isNotNull, isUndefined, isNotNumber, isNotPlainObject } = require('ramda-adjunct');
const {
  getOr, __, divide, floor, remove, every, head, defaultTo, eq, flow, pickBy, round, get, size,
} = require('lodash/fp');

const { WirelessModeEnum } = require('../../../../../../enums');
const { isLogicalWifiInterfaceType } = require('../../utils');
const {
  parseHwDeviceName, parseHwFirmwareVersion, parseHwCpuUsage, parseHwMemoryUsage,
  parseHwUptime, parseHwPingStatsErrors, parseHwPingStatsLatency, parseHwSSID, parseHwFrequency,
  parseHwSecurity, parseHwDistance, parseHwNetworkMode, parseHwChainMaskToChains,
} = require('../parsers');
const { parseHwInterfaceList, parseHwInterfaceStatistics } = require('../../interfaces/parsers');

// parseHwStationListCount :: HwStatus -> Number
const parseHwStationListCount = flow(get(['data', 'wireless', 'sta']), size);

// parseHwSignal :: HwStatus -> Number
//     HwStatus = Object
const parseHwSignal = flow(
  when(
    hwStatus => parseHwStationListCount(hwStatus) === 1,
    getOr(null, ['data', 'wireless', 'sta', '0', 'signal'])
  ),
  when(isNotNumber, always(null)),
  when(isNotNull, round)
);

// parseHwRemoteSignal :: HwStatus -> Number
//     HwStatus = Object
const parseHwRemoteSignal = flow(
  when(
    hwStatus => parseHwStationListCount(hwStatus) === 1,
    getOr(null, ['data', 'wireless', 'sta', '0', 'remote', 'signal'])
  ),
  when(isNotNumber, always(null)),
  when(isNotNull, round)
);

// parseHwChannelWidth :: HwStatus -> Number
//     HwStatus = Object
const parseHwChannelWidth = getOr(0, ['data', 'wireless', 'chanbw']);

// parseHwLanStatus :: HwStatus -> CmLanStatus
//     HwStatus = Object
//     CmLanStatus = Object
const parseHwLanStatus = (hwStatus) => {
  const cmInterfaceList = parseHwInterfaceList({}, hwStatus);
  const eth0 = find(pathEq(['identification', 'name'], 'eth0'), cmInterfaceList);
  const eth1 = find(pathEq(['identification', 'name'], 'eth1'), cmInterfaceList);

  return {
    eth0: {
      description: eth0.status.description,
      plugged: eth0.status.plugged,
      speed: eth0.status.speed,
      duplex: eth0.status.duplex,
    },
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

/**
 * @function parseHwLatestAnze
 * @param {Array.<Array.<number>>} anzeList
 * @return {Array.<number>}
 */
const parseHwLatestAnze = flow(
  remove(every(eq(0))),
  head,
  defaultTo([])
);

/**
 * @function parseHwLatestAnze
 * @param {Array.<number>} frequencies
 * @return {Array.<number>}
 */
const parseAirViewFrequencies = map(flow(divide(__, 10000), floor));

// parseHwFrequencyCenter :: HwStatus -> Number
const parseHwFrequencyCenter = getOr(0, ['data', 'wireless', 'center1_freq']);

// parseHwTransmitPower :: HwStatus -> Number
const parseHwTransmitPower = getOr(0, ['data', 'wireless', 'txpower']);

// parseHwTransmitChains :: HwStatus -> Number
const parseHwTransmitChains = flow(getOr(0, ['data', 'wireless', 'tx_chainmask']), parseHwChainMaskToChains);

// parseHwReceiveChains :: HwStatus -> Number
const parseHwReceiveChains = flow(getOr(0, ['data', 'wireless', 'rx_chainmask']), parseHwChainMaskToChains);

// parseHwApMacAddress :: HwStatus -> String|Null
const parseHwApMacAddress = getOr(null, ['data', 'wireless', 'apmac']);

// parseHwNoiseFloor :: HwStatus -> Number
const parseHwNoiseFloor = getOr(0, ['data', 'wireless', 'noisef']);

// parseHwWlanInterfaceMacAddress :: HwStatus -> Array<String>|Null
const parseHwWlanInterfaceMacAddress = flow(
  get(['data', 'interfaces']),
  filter(flow(getOr(null, ['ifname']), isLogicalWifiInterfaceType)),
  map(getOr(null, ['hwaddr'])),
  uniq
);

// parseHwWirelessMode :: HwStatus -> Mode
//     HwStatus = Object
//     Mode = String
const parseHwWirelessMode = (hwStatus) => {
  const mode = getOr(null, ['data', 'wireless', 'mode'], hwStatus);
  const compact11n = getOr(null, ['data', 'wireless', 'compat_11n'], hwStatus);

  if (mode === WirelessModeEnum.ApPtmp && compact11n) { return WirelessModeEnum.ApPtmpAirmaxMixed }
  if (mode === WirelessModeEnum.ApPtmp && !compact11n) { return WirelessModeEnum.ApPtmpAirmaxAc }

  return mode;
};

/**
 * @param {number} currentTimestamp
 * @param {Object} hwStatus
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwStatus = ({ currentTimestamp = Date.now() }, hwStatus) => ({
  identification: {
    name: parseHwDeviceName(hwStatus),
    firmwareVersion: parseHwFirmwareVersion(hwStatus),
    updated: currentTimestamp,
  },
  overview: {
    cpu: parseHwCpuUsage(hwStatus),
    ram: parseHwMemoryUsage(hwStatus),
    signal: parseHwSignal(hwStatus),
    distance: parseHwDistance(hwStatus),
    transmitPower: parseHwTransmitPower(hwStatus),
    lastSeen: currentTimestamp,
    uptime: parseHwUptime(hwStatus),
  },
  mode: parseHwNetworkMode(hwStatus),
  airmax: {
    ssid: parseHwSSID(hwStatus),
    frequency: parseHwFrequency(hwStatus),
    frequencyCenter: parseHwFrequencyCenter(hwStatus),
    security: parseHwSecurity(hwStatus),
    channelWidth: parseHwChannelWidth(hwStatus),
    noiseFloor: parseHwNoiseFloor(hwStatus),
    stationsCount: parseHwStationListCount(hwStatus),
    wirelessMode: parseHwWirelessMode(hwStatus),
    remoteSignal: parseHwRemoteSignal(hwStatus),
    lanStatus: parseHwLanStatus(hwStatus),
    transmitChains: parseHwTransmitChains(hwStatus),
    receiveChains: parseHwReceiveChains(hwStatus),
    apMac: parseHwApMacAddress(hwStatus),
    wlanMac: parseHwWlanInterfaceMacAddress(hwStatus),
  },
  interfaces: parseHwInterfaceList({ currentTimestamp }, hwStatus),
});

/**
 * Code taken from AirOS sources file: js/apps/airview/channel_usage_stats.js
 *
 * @param {Object} auxiliaries
 * @param {Object} hwAirView
 * @return {CorrespondenceDeviceUpdate}
 */
const parseHwFrequencyBands = (auxiliaries, hwAirView) => {
  if (isNotPlainObject(hwAirView)) {
    return {
      airmax: {
        frequencyBands: null,
      },
    };
  }

  const frequencies = parseAirViewFrequencies(hwAirView.ltFreqGridLabels);
  let latestAnze = parseHwLatestAnze(hwAirView.latestAnze);

  // generate latestAnze
  if (latestAnze.length === 0) {
    const delta = (hwAirView.ltFreqGridLabels[1] - hwAirView.ltFreqGridLabels[0]) / 2;
    let position = 0;
    latestAnze = hwAirView.ltFreqGridLabels.map((value) => {
      let sum = 0;
      if (position >= hwAirView.stFreqGridLabels.length) {
        return sum;
      }

      for (; position < hwAirView.stFreqGridLabels.length; position += 1) {
        if (Math.abs(value - hwAirView.stFreqGridLabels[position]) <= delta) {
          sum += hwAirView.latestPower[position];
        } else {
          return sum;
        }
      }

      return sum;
    });
  }

  return {
    airmax: {
      frequencyBands: zip(frequencies, latestAnze),
    },
  };
};

/**
 * @param {number} currentTimestamp
 * @param {Object} hwStatus
 * @param {Object} hwPingStats
 * @return {CorrespondenceStatistics}
 */
const parseHwDeviceStatistics = ({ currentTimestamp = Date.now() }, { hwStatus, hwPingStats }) => {
  const cmStatistics = {
    timestamp: currentTimestamp,
    weight: 1,
    interfaces: parseHwInterfaceStatistics(hwStatus),
    stats: {
      signal: parseHwSignal(hwStatus),
      remoteSignal: parseHwRemoteSignal(hwStatus),
      ping: parseHwPingStatsLatency(hwPingStats),
      errors: parseHwPingStatsErrors(hwPingStats),
      ram: parseHwMemoryUsage(hwStatus),
      cpu: parseHwCpuUsage(hwStatus),
    },
  };

  // collect metrics only when it makes sense and at least one station device is connected
  return over(lensProp('stats'), pickBy(isNotNull), cmStatistics);
};


module.exports = {
  parseHwStatus,
  parseHwDeviceStatistics,
  parseHwFrequencyBands,
};
