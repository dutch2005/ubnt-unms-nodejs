'use strict';

const { keys, includes, curry } = require('lodash');
const { getOr } = require('lodash/fp');
const { assocPath } = require('ramda');

const { DB } = require('../../db');
const config = require('../../../config');
const { safeTrim } = require('../../util');
const { getPonDataStatistics, getSfpDataStatistics } = require('../utils');
const { collectForInterfaces } = require('../../statistics');
const { DeviceModelEnum } = require('../../enums');

/*
 {
 "pon-stats":
 {
 "pon1":
 {
 "up": "true",
 "l1up": "true",
 "speed": "2500",
 "is_sfp": "true",
 "sfp_present": "true",
 "sfp_vendor": "Ubiquiti Networks",
 "sfp_part": "",
 "auth_mode": "none",
 "stats":
 {
 "pon_bip8_errors": "0",
 "pon_rx_packets_dropped": "0",
 "pon_rx_gem_dropped": "0",
 "pon_tx_dropped_illegal_length": "0",
 "pon_tx_dropped_vid_miss": "0",
 "pon_rx_frames": "0",
 "pon_rx_bytes": "0",
 "pon_rx_good_frames": "0",
 "pon_rx_unicast_frames": "0",
 "pon_rx_multicast_frames": "0",
 "pon_rx_broadcast_frames": "0",
 "pon_rx_fcs_errors": "0",
 "pon_tx_frames": "0",
 "pon_tx_bytes": "0",
 "pon_tx_good_frames": "0",
 "pon_tx_unicast_frames": "0",
 "pon_tx_multicast_frames": "0",
 "pon_tx_broadcast_frames": "0",
 "pon_tx_fcs_errors": "0",
 "pon_tx_bps": "0",
 "pon_rx_bps": "0"
 }
 },
 .....
 },
 "nni-stats":
 {
 "sfp+1":
 {
 "up": "true",
 "l1up": "true",
 "speed": "10G",
 "autoneg": "false",
 "on_switch": "false",
 "is_switched_port": "false",
 "is_combo": "false",
 "is_sfp": "true",
 "sfp_present": "true",
 "sfp_vendor": "Ubiquiti Networks",
 "sfp_part": "",
 "stats":
 {
 "rx_bytes": "0",
 "rx_packets": "0",
 "rx_unicast": "0",
 "rx_multicast": "0",
 "rx_broadcast": "0",
 "rx_dropped": "0",
 "rx_error": "0",
 "tx_bytes": "458117",
 "tx_packets": "3758",
 "tx_unicast": "0",
 "tx_multicast": "1169",
 "tx_broadcast": "2589",
 "tx_error": "0",
 "tx_dropped": "0"
 }
 }
 ....
 }
 }
 */

function mergePonInterface(interfaces, interfaceName, interfaceData) {
  if (includes(interfaceName, 'pon')) {
    let oldInterface = interfaces.find(i => (i.identification.name === interfaceName));

    const { mac, speed, l1up, stats,
      is_sfp: isSfp, sfp_part: sfpPart, sfp_present: sfpPresent, sfp_vendor: sfpVendor } = interfaceData;

    if (!oldInterface) {
      oldInterface = {};
      interfaces.push(oldInterface);
    }

    // identification
    oldInterface.identification = {
      mac,
      position: Number(interfaceName.replace(/[a-z]/g, '')),
      type: interfaceName.replace(/[0-9]/g, ''),
      name: interfaceName,
      description: getOr(interfaceName, ['identification', 'description'], oldInterface),
    };

    // status
    oldInterface.status = {
      description: speed ? `${speed} Mbps` : '',
      plugged: l1up === 'true',
      speed: Number(speed),
      duplex: null,
      sfp: (() => {
        if (!(isSfp === 'true' || sfpPresent === 'true')) { return null }

        return {
          present: sfpPresent === 'true',
          vendor: safeTrim(sfpVendor),
          part: safeTrim(sfpPart),
          olt: true,
          maxSpeed: 2500,
        };
      })(),
    };

    // TODO(vladimir.gorej@gmail.com): this is QF for different parsing of tx and rx rates for olt and erouter
    // TODO(vladimir.gorej@gmail.com): this must be refactored into device specofic transformers in the future
    oldInterface.statistics = getPonDataStatistics(stats, oldInterface);
    oldInterface.statistics.rxrate /= 8;
    oldInterface.statistics.txrate /= 8;

    // pon statistics
    oldInterface.ponStatistics = {
      registrationStatus: 'Connected',
      transmitPower: 0,
      receivePower: 0,
      temperature: 0,
      voltage: 0,
      distance: 0,
      biasCurrent: 0,
    };
  }
}

function mergeSfpInterface(interfaces, interfaceName, interfaceData) {
  if (interfaceName.indexOf('sfp') === 0) {
    let oldInterface = interfaces.find(i => (i.identification.name === interfaceName));
    const { mac, speed, l1up, stats,
      is_sfp: isSfp, sfp_part: sfpPart, sfp_present: sfpPresent, sfp_vendor: sfpVendor } = interfaceData;

    if (!oldInterface) {
      oldInterface = {};
      interfaces.push(oldInterface);
    }

    // identification
    oldInterface.identification = {
      mac,
      position: Number(interfaceName.replace(/[a-z]/g, '')),
      type: interfaceName.replace(/[0-9]/g, ''),
      name: interfaceName,
      description: getOr(interfaceName, ['identification', 'description'], oldInterface),
    };

    // status
    oldInterface.status = {
      description: speed ? `${speed} Mbps` : '',
      plugged: l1up === 'true',
      speed: speed === '10G' ? 10000 : Number(speed),
      duplex: null,
      sfp: (() => {
        if (!(isSfp === 'true' || sfpPresent === 'true')) { return null }

        return {
          present: sfpPresent === 'true',
          vendor: safeTrim(sfpVendor),
          part: safeTrim(sfpPart),
          olt: true,
          maxSpeed: 10000,
        };
      })(),
    };

    // TODO(vladimir.gorej@gmail.com): this is QF for different parsing of tx and rx rates for olt and erouter
    // TODO(vladimir.gorej@gmail.com): this must be refactored into device specific transformers in the future
    oldInterface.statistics = getSfpDataStatistics(stats, oldInterface);
    oldInterface.statistics.rxrate /= 8;
    oldInterface.statistics.txrate /= 8;
  }
}

// filter sfp+2 from OLT4
const olt4InterfaceSfpFilter = curry((model, interfaceName) =>
  model !== DeviceModelEnum.UFOLT4 || interfaceName !== 'sfp+2'
);

const normalizeDbOlt4Interfaces = (dbOlt) => {
  const model = dbOlt.identification.model;
  if (model !== DeviceModelEnum.UFOLT4) { return }
  // eslint-disable-next-line no-param-reassign
  dbOlt.interfaces = dbOlt.interfaces.filter(olt4InterfaceSfpFilter(model));
};


function mergeInterfaces(commOlt, databaseOlt) {
  const dbOlt = databaseOlt;
  if (!dbOlt.interfaces) {
    dbOlt.interfaces = [];
  }

  normalizeDbOlt4Interfaces(dbOlt);

  // pon ports
  keys(commOlt.stats.pon).forEach((interfaceName) => {
    if (Object.prototype.hasOwnProperty.call(commOlt.stats.pon, interfaceName)) {
      mergePonInterface(dbOlt.interfaces, interfaceName, commOlt.stats.pon[interfaceName]);
    }
  });

  // sfp ports
  keys(commOlt.stats.sfp).forEach((interfaceName) => {
    if (Object.prototype.hasOwnProperty.call(commOlt.stats.sfp, interfaceName)) {
      mergeSfpInterface(dbOlt.interfaces, interfaceName, commOlt.stats.sfp[interfaceName]);
    }
  });

  dbOlt.interfaces.sort((i1, i2) => (i1.identification.name.localeCompare(i2.identification.name)));
}

function updateOlt(commOlt, dbOlt) {
  mergeInterfaces(commOlt, dbOlt);
  return DB.olt.insert(
    assocPath(['overview', 'lastSeen'], Date.now(), dbOlt)
  );
}

function interfaceStatsFilter(interfaceName) {
  return /^(sfp|pon)/.test(interfaceName);
}

/**
 * Generate new data item for interface statistics
 *
 * @param {number} timestamp
 * @param {Object} dbOlt
 * @param {Object} pon
 * @param {Object} sfp
 * @return {{timestamp: number, interfaces: Object<string, {weight: number, stats: Object}>}}
 */
function getInterfaceStats(timestamp, dbOlt, pon, sfp) {
  const interfaces = {};

  Object.keys(pon).filter(interfaceStatsFilter).forEach((interfaceName) => {
    interfaces[interfaceName] = {
      weight: 1,
      stats: {
        rx_bps: parseInt(pon[interfaceName].stats.pon_rx_bps, 10),
        tx_bps: parseInt(pon[interfaceName].stats.pon_tx_bps, 10),
      },
    };
  });

  Object.keys(sfp)
    .filter(olt4InterfaceSfpFilter(dbOlt.identification.model))
    .filter(interfaceStatsFilter)
    .forEach((interfaceName) => {
      interfaces[interfaceName] = {
        weight: 1,
        stats: {
          rx_bps: parseInt(sfp[interfaceName].stats.rx_bps || '0', 10),
          tx_bps: parseInt(sfp[interfaceName].stats.tx_bps || '0', 10),
        },
      };
    });

  return { timestamp, interfaces };
}

/**
 * Merge interfaces event from OLT
 *
 * @param {Object} event
 * @return {Promise}
 */
function run(event) {
  const timestamp = new Date().setMilliseconds(0);

  return DB.olt.findById(event.id).then((dbOlt) => {
    const commOlt = event.device;
    if (commOlt && dbOlt) {
      commOlt.stats.pon = event.payload['pon-stats'];
      commOlt.stats.sfp = event.payload['nni-stats'];

      const statistics = getInterfaceStats(timestamp, dbOlt, commOlt.stats.pon, commOlt.stats.sfp);
      const updateStatistics = collectForInterfaces(event.id, statistics).run({ DB, config });
      const updateDevice = updateOlt(commOlt, dbOlt);

      return Promise.all([updateStatistics, updateDevice]);
    }
    return null;
  });
}

const ponHandler = ({ deviceId, payload }) => {
  const event = { id: deviceId, device: { stats: { } }, payload };

  return run(event);
};

module.exports = ponHandler;

