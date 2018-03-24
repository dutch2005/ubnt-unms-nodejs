'use strict';

// TODO(michal.sedlak@ubnt.com): This is OLD code and has to be refactored
const { Reader: reader } = require('monet');
const { pathEq, assocPath, pick, either, when, merge, propEq, prop } = require('ramda');
const { isNotNull } = require('ramda-adjunct');
const { filter, flow, get, getOr, set, isNil, __, values, sumBy, parseInt, gt, lt, constant } = require('lodash/fp');

const { DB } = require('../db');
const { StatusEnum, TemperatureTypeEnum, DeviceTransmissionProfileSettingsEnum } = require('../enums');
const { isNotEmpty, resolveP } = require('../util');
const { fromDbDevice: fromDbDeviceIpAddress } = require('../transformers/device/ip-address');

// isDeviceInSite :: Object -> Object -> Boolean
const isDeviceInSite = dbSite => pathEq(['identification', 'site', 'id'], get(['identification', 'id'], dbSite));

const isDeviceDisconnected = pathEq(['overview', 'status'], StatusEnum.Disconnected);

// set site status to 'active' OR 'disconnected' so it complies with its devices' statuses
const synchronizeSiteStatus = (dbSite) => {
  if (dbSite === null) { return null }

  const devicesPromise = DB.device.list()
    .then(filter(isDeviceInSite(dbSite)));

  const isSomeDeviceDisconnectedPromise = devicesPromise
    .then(filter(isDeviceDisconnected))
    .then(isNotEmpty);

  return Promise.all([devicesPromise, isSomeDeviceDisconnectedPromise])
    .then(([devices, isSomeDeviceDisconnected]) => {
      let status = StatusEnum.Inactive;
      if (isNotEmpty(devices)) {
        status = isSomeDeviceDisconnected ? StatusEnum.Disconnected : StatusEnum.Active;
      }
      return assocPath(['identification', 'status'], status, dbSite);
    })
    .then(DB.site.update);
};

const synchronizeSiteStatusByDevice = cmDevice => resolveP(getOr(null, ['identification', 'siteId'], cmDevice))
  .then(when(isNotNull, DB.site.findById))
  .then(synchronizeSiteStatus);

const updateDeviceIpAddress = dbDevice => fromDbDeviceIpAddress({}, dbDevice)
    .cata(constant(dbDevice), set(['identification', 'ipAddress'], __, dbDevice));

function interfaceStatus(intfc) {
  const isEnabled = getOr(false, 'enabled', intfc);
  const isPlugged = getOr(false, ['status', 'plugged'], intfc);

  if (isEnabled && !isPlugged) {
    return StatusEnum.Disconnected;
  } else if (!isEnabled) {
    return StatusEnum.Disabled;
  }
  return StatusEnum.Active;
}

function formatHWTemperatureType(name) {
  switch (name) {
    case 'Board 1':
    case 'Board 2':
    case 'Board 3':
    case 'Board (PHY)':
    case 'Board (CPU)':
    case 'PHY':
    case 'PHY 1':
    case 'PHY 2': return TemperatureTypeEnum.BOARD;
    case 'cpu':
    case 'CPU': return TemperatureTypeEnum.CPU;
    default: return TemperatureTypeEnum.BOARD;
  }
}

function formatHwTemperatures(hwTemps) {
  if (isNil(hwTemps)) { return [] }
  return Object.keys(hwTemps).map(hwTempName => ({
    value: Number(hwTemps[hwTempName].replace(' C', '')),
    type: formatHWTemperatureType(hwTempName),
    name: hwTempName,
  }))
  // remove duplicity
    .filter(t => (t.name !== 'PHY' && t.name !== 'Board (PHY)'))
    // remove empty values
    .filter(t => (t.value !== 0));
}

const parseRxbytes = (path, hwInterfaceStats) => flow(getOr(0, path), Number)(hwInterfaceStats);
const parseTxbytes = (path, hwInterfaceStats) => flow(getOr(0, path), Number)(hwInterfaceStats);
const parseDropped = (keys, hwInterfaceStats) => flow(pick(keys), values, sumBy(Number))(hwInterfaceStats);
const parseErrors = (keys, hwInterfaceStats) => flow(pick(keys), values, sumBy(Number))(hwInterfaceStats);
const parseMulticast = flow(pick(['pon_tx_multicast_frames', 'pon_rx_multicast_frames']), values, sumBy(Number));

const resetPreviousValues = (stats) => {
  const {
    previousDropped, previousErrors, previousRxbytes, previousTxbytes, dropped, errors, rxbytes, txbytes,
  } = stats;

  const isStatsReset = previousDropped > dropped
    || previousErrors > errors
    || previousRxbytes > rxbytes
    || previousTxbytes > txbytes;

  if (!isStatsReset) { return stats }

  return merge(stats, {
    previousDropped: 0,
    previousErrors: 0,
    previousRxbytes: 0,
    previousTxbytes: 0,
  });
};


const getDataStatistics = (hwInterfaceStats, oldInterface) => {
  const stats = {
    timestamp: Date.now(),
    rxrate: parseInt(10, hwInterfaceStats.rx_bps) * 8,
    txrate: parseInt(10, hwInterfaceStats.tx_bps) * 8,
    rxbytes: parseRxbytes(['rx_bytes'], hwInterfaceStats),
    txbytes: parseTxbytes(['tx_bytes'], hwInterfaceStats),
    dropped: parseDropped(['rx_dropped', 'tx_dropped'], hwInterfaceStats),
    errors: parseErrors(['rx_errors', 'tx_errors'], hwInterfaceStats),
    previousDropped: getOr(0, ['statistics', 'previousDropped'], oldInterface),
    previousErrors: getOr(0, ['statistics', 'previousErrors'], oldInterface),
    previousRxbytes: getOr(0, ['statistics', 'previousRxbytes'], oldInterface),
    previousTxbytes: getOr(0, ['statistics', 'previousTxbytes'], oldInterface),
  };

  return resetPreviousValues(stats);
};

const getPonDataStatistics = (hwInterfaceStats, oldInterface) => {
  const stats = {
    timestamp: Date.now(),
    rxrate: Number(hwInterfaceStats.pon_rx_bps) * 8,
    txrate: Number(hwInterfaceStats.pon_tx_bps) * 8,
    multicastFrames: parseMulticast(hwInterfaceStats),
    rxbytes: parseRxbytes(['pon_rx_bytes'], hwInterfaceStats),
    txbytes: parseTxbytes(['pon_tx_bytes'], hwInterfaceStats),
    dropped: parseDropped(['pon_tx_dropped_vid_miss', 'pon_tx_dropped_illegal_length'], hwInterfaceStats),
    errors: parseErrors(['pon_rx_fcs_errors', 'pon_tx_fcs_errors'], hwInterfaceStats),
    previousDropped: getOr(0, ['statistics', 'previousDropped'], oldInterface),
    previousErrors: getOr(0, ['statistics', 'previousErrors'], oldInterface),
    previousRxbytes: getOr(0, ['statistics', 'previousRxbytes'], oldInterface),
    previousTxbytes: getOr(0, ['statistics', 'previousTxbytes'], oldInterface),
  };

  return resetPreviousValues(stats);
};

const getSfpDataStatistics = (hwInterfaceStats, oldInterface) => {
  const stats = {
    timestamp: Date.now(),
    rxrate: Number(hwInterfaceStats.rx_bps) * 8,
    txrate: Number(hwInterfaceStats.tx_bps) * 8,
    dropped: null,
    errors: null,
    rxbytes: parseRxbytes(['rx_bytes'], hwInterfaceStats),
    txbytes: parseTxbytes(['tx_bytes'], hwInterfaceStats),
    previousDropped: 0,
    previousErrors: 0,
    previousRxbytes: getOr(0, ['statistics', 'previousRxbytes'], oldInterface),
    previousTxbytes: getOr(0, ['statistics', 'previousTxbytes'], oldInterface),
  };

  return resetPreviousValues(stats);
};

const parseSpeed = flow(
  parseInt(10),
  when(either(gt(__, 3 * 10e9), lt(__, 0)), constant(0))
);

const getOnuDataStatistics = (hwInterfaceStats, oldOnuStats) => {
  const stats = {
    timestamp: Date.now(),
    rxrate: parseSpeed(hwInterfaceStats.rx_bps),
    txrate: parseSpeed(hwInterfaceStats.tx_bps),
    dropped: null,
    errors: null,
    rxbytes: parseRxbytes(['rx_bytes'], hwInterfaceStats),
    txbytes: parseTxbytes(['tx_bytes'], hwInterfaceStats),
    previousDropped: 0,
    previousErrors: 0,
    previousRxbytes: getOr(0, ['statistics', 'previousRxbytes'], oldOnuStats),
    previousTxbytes: getOr(0, ['statistics', 'previousTxbytes'], oldOnuStats),
  };

  return resetPreviousValues(stats);
};

/**
 * Gets device UNMS settings property value
 * @param {string} unmsSettingsProp
 * @return {Reader.<getUnmsSettingsProp~callback>}
 */
const getUnmsSettingsProp = unmsSettingsProp => reader(
  /**
   * @param {nms} nms
   * @param {unmsSettings} unmsSettings
   * @return {string|number}
   */
  ({ nms, unmsSettings }) => {
    let { deviceTransmissionProfile } = nms;

    if (propEq('overrideGlobal', true, unmsSettings)) {
      deviceTransmissionProfile = unmsSettings.deviceTransmissionProfile;
    }

    return getOr(
      prop(unmsSettingsProp, DeviceTransmissionProfileSettingsEnum.low),
      [unmsSettingsProp],
      DeviceTransmissionProfileSettingsEnum[deviceTransmissionProfile]);
  });


module.exports = {
  formatHwTemperatures,
  getDataStatistics,
  getOnuDataStatistics,
  getPonDataStatistics,
  getSfpDataStatistics,
  getUnmsSettingsProp,
  interfaceStatus,
  parseSpeed,
  synchronizeSiteStatus,
  updateDeviceIpAddress,
  synchronizeSiteStatusByDevice,
};
