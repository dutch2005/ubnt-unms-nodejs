'use strict';

const { Reader: reader } = require('monet');
const { omit } = require('ramda');
const { weave } = require('ramda-adjunct');

// TODO(michal.sedlak@ubnt.com): This is OLD code and has to be refactored
const {
  assign, isArray, merge, getOr, spread, partial, flow, isUndefined, nthArg, pickBy, clone,
} = require('lodash/fp');
const { anyPass } = require('ramda');

const { DB } = require('../../db');
const config = require('../../../config');
const { collectForInterfaces } = require('../../statistics');
const { StatusEnum } = require('../../enums');
const { normalizeDeviceAddress, safeTrim } = require('../../util');
const { interfaceStatus, getDataStatistics } = require('../utils');
const {
  isVlanInterfaceType, isEthernetInterfaceType, isSwitchInterfaceType, isPPPoEInterfaceType, isBridgeInterfaceType,
} = require('../../transformers/interfaces/utils');

// isMergeableInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isMergeableInterfaceType = anyPass(
  [isSwitchInterfaceType, isEthernetInterfaceType, isPPPoEInterfaceType, isVlanInterfaceType, isBridgeInterfaceType]);

const filterMergeableInterfaces = pickBy(flow(nthArg(1), isMergeableInterfaceType));

/**
 * Merge interface from Erouter to DB Erouter
 *
 * @param {Object} dbErouter
 * @param {Object} hwInterfaces
 * @param {Object} dbInterface
 * @return {Object}
 */
const mergeInterface = (dbErouter, hwInterfaces, dbInterface) => reader(
  ({ eventLog, shouldLog }) => {
    const interfaceName = dbInterface.identification.name;
    const hwInterface = hwInterfaces[interfaceName];
    if (isUndefined(hwInterface)) { return dbInterface }

    const {
      mac, mtu, duplex, speed, l1up, is_sfp: isSfp, sfp_present: sfpPresent, sfp_part: sfpPart,
      sfp_vendor: sfpVendor, stats, addresses, is_switched_port: isSwitchedPort, on_switch: onSwitch,
    } = hwInterface;
    const oldInterfaceStatus = interfaceStatus(dbInterface);

    const status = clone(dbInterface.status);

    status.plugged = l1up === 'true';
    // status
    if (isEthernetInterfaceType(interfaceName)) {
      const fullDuplex = duplex !== 'half';
      status.description = speed ? `${speed} Mbps - ${fullDuplex ? 'Full' : 'Half'} Duplex` : '';
      status.speed = Number(speed);
      status.duplex = fullDuplex;
      status.spf = !(isSfp === 'true' || sfpPresent === 'true')
        ? null
        : {
          present: sfpPresent === 'true',
          vendor: safeTrim(sfpVendor),
          part: safeTrim(sfpPart),
          olt: false,
          maxSpeed: 1000, // TODO(michal.sedlak@ubnt.com): Detect ER Infinity and set to 10000
        };
    }

    const updatedDbInterface = merge(dbInterface, {
      identification: { mac },
      mtu: parseInt(mtu, 10),
      isSwitchedPort: isSwitchedPort === 'true',
      onSwitch: onSwitch === 'true',
      statistics: getDataStatistics(stats, dbInterface),
      addresses: isArray(addresses) ? addresses.map(normalizeDeviceAddress) : [],
      status,
    });

    // log change of interface status.parseHwDevice
    const newInterfaceStatus = interfaceStatus(updatedDbInterface);
    const deviceId = getOr(null, ['identification', 'id'], dbErouter);
    if (
      shouldLog &&
      oldInterfaceStatus === StatusEnum.Disconnected &&
      newInterfaceStatus === StatusEnum.Active
    ) {
      eventLog.logInterfaceConnected({ deviceId }, interfaceName);
    } else if (
      shouldLog &&
      oldInterfaceStatus === StatusEnum.Active &&
      newInterfaceStatus === StatusEnum.Disconnected
    ) {
      eventLog.logInterfaceDisconnected({ deviceId }, interfaceName);
    }

    return updatedDbInterface;
  }
);

/**
 * @param {Object} event
 * @param {Object} dbErouter
 * @return {Promise}
 */
const updateErouterInterfaces = (event, dbErouter) => reader(
  ({ eventLog, shouldLog }) => {
    const hwInterfaces = filterMergeableInterfaces(event.payload);
    const merger = partial(weave(mergeInterface, { eventLog, shouldLog }), [dbErouter, hwInterfaces]);

    const dbDevice = assign(dbErouter, { interfaces: dbErouter.interfaces.map(merger) });
    dbDevice.overview.lastSeen = Date.now();

    return DB.erouter.update(dbDevice);
  }
);

// interfaceStatusFilter :: InterfaceName -> Boolean
//     InterfaceName = String
const interfaceStatsFilter = anyPass([
  isPPPoEInterfaceType, isEthernetInterfaceType, isSwitchInterfaceType, isVlanInterfaceType]);

/**
 * Generate new data item for interface statistics
 *
 * @param {number} timestamp
 * @param {Object} eventPayload
 * @return {{timestamp: number, interfaces: Object.<string, {weight: number, stats: {}}>}}
 */
function getInterfaceStats(timestamp, eventPayload) {
  const interfaces = {};
  Object.keys(eventPayload).filter(interfaceStatsFilter).forEach((interfaceName) => {
    interfaces[interfaceName] = {
      weight: 1,
      stats: {
        rx_bps: parseInt(eventPayload[interfaceName].stats.rx_bps, 10) * 8,
        tx_bps: parseInt(eventPayload[interfaceName].stats.tx_bps, 10) * 8,
      },
    };
  });
  return { timestamp, interfaces };
}

function updateStatistics(event) {
  return collectForInterfaces(event.id, getInterfaceStats(new Date().setMilliseconds(0), event.payload))
    .run({ DB, config });
}

/**
 * Merge interfaces event from Erouter
 *
 * @param {Object} event
 * @return {Promise}
 */
function run(event) {
  const eventLog = event.device.server.plugins.eventLog;
  const shouldLog = event.aux.shouldLog;

  const dbErouterPromise = DB.erouter.findById(event.id);
  const updater = partial(weave(updateErouterInterfaces, { eventLog, shouldLog }), [event]);

  return Promise.all([
    dbErouterPromise,
    updateStatistics(event),
  ])
    .then(spread(updater));
}

const interfacesHandler = ({ deviceId, payload: data }) => reader(
  ({ eventLog }) => {
    // shouldLog property is being injected at events middleware
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

