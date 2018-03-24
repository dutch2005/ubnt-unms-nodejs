'use strict';

const { Reader: reader } = require('monet');
const { omit } = require('ramda');
const { weave } = require('ramda-adjunct');

// TODO(michal.sedlak@ubnt.com): This is OLD code and has to be refactored
const { keys, isEmpty, getOr, spread, curry } = require('lodash/fp');
const { assocPath } = require('ramda');

const { StatusEnum } = require('../../enums');
const { DB } = require('../../db');
const config = require('../../../config');
const { collectForInterfaces } = require('../../statistics');
const { normalizeDeviceAddress, safeTrim } = require('../../util');
const { interfaceStatus, getDataStatistics } = require('../utils');
const { interfaceNameToType } = require('../../transformers/interfaces/utils');

/*
 {
 "eth5.4093":{
 "up":"true",
 "l1up":"true",
 "mac":"04:18:d6:a0:5a:ae",
 "mtu":"1500",
 "addresses":[
 "169.254.166.1/24"
 ],
 "stats":{
 "rx_packets":"129839",
 "tx_packets":"170764",
 "rx_bytes":"21147836",
 "tx_bytes":"11846577",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"6",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "eth5":{
 "up":"true",
 "l1up":"true",
 "mac":"04:18:d6:a0:5a:ae",
 "mtu":"1500",
 "addresses":"",
 "stats":{
 "rx_packets":"138721",
 "tx_packets":"170923",
 "rx_bytes":"25097130",
 "tx_bytes":"13220887",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"8867",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"61",
 "tx_bps":"0"
 }
 },
 "eth4":{
 "up":"true",
 "l1up":"false",
 "mac":"04:18:d6:a0:5a:ad",
 "mtu":"1500",
 "stats":{
 "rx_packets":"0",
 "tx_packets":"0",
 "rx_bytes":"0",
 "tx_bytes":"0",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "eth3":{
 "up":"true",
 "l1up":"false",
 "mac":"04:18:d6:a0:5a:ac",
 "mtu":"1500",
 "stats":{
 "rx_packets":"0",
 "tx_packets":"0",
 "rx_bytes":"0",
 "tx_bytes":"0",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "eth2":{
 "up":"true",
 "l1up":"false",
 "mac":"04:18:d6:a0:5a:ab",
 "mtu":"1500",
 "stats":{
 "rx_packets":"0",
 "tx_packets":"0",
 "rx_bytes":"0",
 "tx_bytes":"0",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "eth1":{
 "up":"true",
 "l1up":"false",
 "mac":"04:18:d6:a0:5a:aa",
 "mtu":"1500",
 "stats":{
 "rx_packets":"0",
 "tx_packets":"0",
 "rx_bytes":"0",
 "tx_bytes":"0",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "eth0":{
 "up":"true",
 "l1up":"true",
 "autoneg":"true",
 "duplex":"full",
 "speed":"1000",
 "on_switch":"true",
 "is_switched_port":"false",
 "is_combo":"false",
 "is_sfp":"false",
 "mac":"04:18:d6:a0:5a:a9",
 "mtu":"1500",
 "addresses":[
 "192.168.99.12/24"
 ],
 "stats":{
 "rx_packets":"124393",
 "tx_packets":"43966",
 "rx_bytes":"15761469",
 "tx_bytes":"31622930",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"7206",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"10305",
 "tx_bps":"52533"
 }
 },
 "imq0":{
 "up":"true",
 "l1up":"true",
 "mtu":"16000",
 "stats":{
 "rx_packets":"0",
 "tx_packets":"154",
 "rx_bytes":"0",
 "tx_bytes":"4928",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"154",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "switch0":{
 "up":"true",
 "l1up":"true",
 "mac":"04:18:d6:a0:5a:af",
 "mtu":"1500",
 "addresses":"",
 "stats":{
 "rx_packets":"0",
 "tx_packets":"158",
 "rx_bytes":"0",
 "tx_bytes":"8124",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 },
 "lo":{
 "up":"true",
 "l1up":"true",
 "mac":"00:00:00:00:00:00",
 "mtu":"65536",
 "addresses":[
 "127.0.0.1/8",
 "::1/128"
 ],
 "stats":{
 "rx_packets":"3555",
 "tx_packets":"3555",
 "rx_bytes":"478416",
 "tx_bytes":"478416",
 "rx_errors":"0",
 "tx_errors":"0",
 "rx_dropped":"0",
 "tx_dropped":"0",
 "multicast":"0",
 "rx_bps":"0",
 "tx_bps":"0"
 }
 }
 }
 */

/**
 * Show interface in UNMS
 *
 * @param {string} interfaceName
 * @return {boolean}
 */
function showInterfaceInUNMS(interfaceName) {
  return /^br\d+/.test(interfaceName);
}

/**
 * Merge interface from OLT to DB OLT
 *
 * @param {Object} dbOlt
 * @param {string} interfaceName
 * @param {Object} interfaceData
 * @return {void}
 */
const mergeInterface = (dbOlt, interfaceName, interfaceData) => reader(
  ({ eventLog, shouldLog }) => {
    if (showInterfaceInUNMS(interfaceName)) {
      const interfaces = dbOlt.interfaces;
      let oldInterface = interfaces.find(i => (i.identification.name === interfaceName));
      const oldInterfaceStatus = interfaceStatus(oldInterface);

      const { mac, mtu, duplex, speed, l1up, addresses, stats,
        is_sfp: isSfp, sfp_part: sfpPart, sfp_present: sfpPresent, sfp_vendor: sfpVendor } = interfaceData;

      if (!oldInterface) {
        oldInterface = {};
        interfaces.push(oldInterface);
      }

      // identification
      oldInterface.identification = {
        mac,
        position: Number(interfaceName.replace(/[a-z]/g, '')),
        type: interfaceNameToType(interfaceName),
        name: interfaceName,
        description: getOr(interfaceName, ['identification', 'description'], oldInterface),
      };

      // update mtu
      oldInterface.mtu = mtu;

      // status
      const fullDuplex = duplex !== 'half';
      oldInterface.status = {
        description: speed ? `${speed} Mbps - ${fullDuplex ? 'Full Duplex' : 'Half Duplex'}` : '',
        plugged: l1up === 'true',
        speed: Number(speed),
        duplex: fullDuplex,
        sfp: (() => {
          if (!(isSfp === 'true' || sfpPresent === 'true')) { return null }

          return {
            present: sfpPresent === 'true',
            vendor: safeTrim(sfpVendor),
            part: safeTrim(sfpPart),
            olt: false,
            maxSpeed: 1000,
          };
        })(),
      };

      // addresses
      if (!isEmpty(addresses)) {
        oldInterface.addresses = addresses.map(normalizeDeviceAddress);
      } else {
        oldInterface.addresses = [];
      }

      // TODO(vladimir.gorej@gmail.com): this is QF for different parsing of tx and rx rates for olt and erouter
      // TODO(vladimir.gorej@gmail.com): this must be refactored into device specific transformers in the future
      oldInterface.statistics = getDataStatistics(stats, oldInterface);
      oldInterface.statistics.rxrate /= 8;
      oldInterface.statistics.txrate /= 8;


      // pon statistics
      oldInterface.ponStatistics = null;

      // log change of interface status.
      const deviceId = getOr(null, ['identification', 'id'], dbOlt);
      if (
        shouldLog &&
        oldInterfaceStatus === StatusEnum.Disconnected &&
        interfaceStatus(oldInterface) === StatusEnum.Active
      ) {
        eventLog.logInterfaceConnected({ deviceId }, interfaceName);
      } else if (
        shouldLog &&
        oldInterfaceStatus === StatusEnum.Active &&
        interfaceStatus(oldInterface) === StatusEnum.Disconnected
      ) {
        eventLog.logInterfaceDisconnected({ deviceId }, interfaceName);
      }
    }
  }
);

/**
 * Merge interfaces from OLT to DB OLT
 *
 * @param {Object} commOlt
 * @param {Object} databaseOlt
 * @return {void}
 */
const mergeInterfaces = (commOlt, databaseOlt) => reader(
  ({ eventLog, shouldLog }) => {
    const dbOlt = databaseOlt;

    if (!dbOlt.interfaces) {
      dbOlt.interfaces = [];
    }

    keys(commOlt.stats.interfaces).forEach((interfaceName) => {
      if (Object.prototype.hasOwnProperty.call(commOlt.stats.interfaces, interfaceName)) {
        mergeInterface(dbOlt, interfaceName, commOlt.stats.interfaces[interfaceName])
          .run({ eventLog, shouldLog });
      }
    });

    dbOlt.interfaces.sort((i1, i2) => (i1.identification.name.localeCompare(i2.identification.name)));

    return dbOlt;
  }
);

/**
 * Update OLT interfaces
 *
 * @param {Object} commOlt
 * @param {Object} dbOlt
 * @return {Promise}
 */
const updateOltInterfaces = (commOlt, dbOlt) => reader(
  ({ eventLog, shouldLog }) => {
    const dbDevice = mergeInterfaces(commOlt, dbOlt)
      .run({ eventLog, shouldLog });
    return DB.olt.insert(
      assocPath(['overview', 'lastSeen'], Date.now(), dbDevice)
    );
  }
);

function interfaceStatsFilter(interfaceName) {
  return /^br/.test(interfaceName);
}

/**
 * Generate new data item for interface statistics
 *
 * @param {number} timestamp
 * @param {Object} eventPayload
 * @return {{timestamp: number, interfaces: Object<string, {weight: number, stats: Object}>}}
 */
function getInterfaceStats(timestamp, eventPayload) {
  const interfaces = {};

  keys(eventPayload).filter(interfaceStatsFilter).forEach((interfaceName) => {
    interfaces[interfaceName] = {
      weight: 1,
      stats: {
        rx_bps: parseInt(eventPayload[interfaceName].stats.rx_bps, 10),
        tx_bps: parseInt(eventPayload[interfaceName].stats.tx_bps, 10),
      },
    };
  });

  return { timestamp, interfaces };
}

function updateStatistics(event) {
  return collectForInterfaces(event.id, getInterfaceStats(new Date().setMilliseconds(0), event.payload))
    .run({ DB, config });
}

const updateOlt = curry((event, dbOlt) => reader(
  ({ eventLog, shouldLog }) => {
    const commOlt = event.device;
    commOlt.stats.interfaces = event.payload;

    return updateOltInterfaces(commOlt, dbOlt)
      .run({ eventLog, shouldLog });
  }
));

/**
 * Merge interfaces event from OLT
 *
 * @param {Object} event
 * @return {Promise}
 */
function run(event) {
  const eventLog = event.device.server.plugins.eventLog;
  const shouldLog = event.aux.shouldLog;

  const dbOltPromise = DB.olt.findById(event.id);

  return Promise.all([
    dbOltPromise,
    updateStatistics(event),
  ])
    .then(spread(weave(updateOlt(event), { eventLog, shouldLog })));
}

const interfacesHandler = ({ deviceId, payload: data }) => reader(
  ({ eventLog }) => {
    // shoulgLog property is being injected at events middleware
    const shouldLog = data.shouldLog; // hack - should be solved differently after refactor
    const payload = omit(['shouldLog'], data);

    const event = {
      id: deviceId,
      aux: { shouldLog },
      device: { stats: {}, server: { plugins: { eventLog } } },
      payload,
    };

    return run(event);
  }
);

module.exports = interfacesHandler;

