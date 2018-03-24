'use strict';

// TODO(michal.sedlak@ubnt.com): This is OLD code and has to be refactored
const aguid = require('aguid');
const { Reader: reader } = require('monet');
const moment = require('moment-timezone');
const { assocPath, when, assoc, map, path, pathEq, tap, test, find, pathSatisfies } = require('ramda');
const { cata, isNotUndefined, weave } = require('ramda-adjunct');
const { get, flow, curry, isUndefined, getOr, keyBy, defaultTo, isNull, negate } = require('lodash/fp');

const config = require('../../../config');
const { collectForInterfaces, collectForDevice } = require('../../statistics');
const { modelToPlatformIds } = require('../../feature-detection/firmware');
const {
  StatusEnum, DevicePropertyEnum, DeviceModelEnum, LogTypeEnum, TaskStatusEnum, LogLevelEnum,
} = require('../../enums');
const { logDeviceProperties } = require('../../device-log');
const store = require('../../store');
const { logDeviceEvent, logDeviceInfoEvent } = require('../../event-log');
const { formatHwTemperatures, getOnuDataStatistics, parseSpeed, synchronizeSiteStatusByDevice } = require('../utils');
const { allP, resolveP, tapP, rejectP, isNotNull } = require('../../util');
const { fromDb, toDb } = require('../../transformers/device');
const { deviceDisconnected: deviceDisconnectedAp } = require('../../transformers/device/ap');
const { fromDb: fromDbDeviceMetadata } = require('../../transformers/device/metadata');
const { merge: mergeM } = require('../../transformers');
const { mergeMetadata } = require('../../transformers/device/mergers');

/*
 * Business logic
 */
const calculateChangeTime = seconds => moment().subtract(seconds, 'seconds').valueOf();

// isOnuSupported :: [hwOnu] -> boolean
const isOnuSupported = onu => (isNotUndefined(onu.authorized)
  ? onu.authorized // as of OLT FW v1.1.0
  : pathSatisfies(test(/^(ubnt)/i), ['serial_number'], onu) // backward compatibility
);

// containsUnsupportedOnu :: [hwOnu] -> boolean
const containsUnsupportedOnu = flow(find(negate(isOnuSupported)), isNotUndefined);


// isNotOltUnauthorized :: dbOlt -> boolean
const isNotOltUnauthorized = negate(pathEq(['overview', 'status'], StatusEnum.Unauthorized));

const parseChangeAtTime = flow(
  getOr(null, ['upgrade_status_changed_ago']),
  when(isNotNull, calculateChangeTime)
);

const parseUpgradeStatus = (progressStatus) => {
  switch (progressStatus) {
    case 'pending':
      return TaskStatusEnum.Queued;
    case 'in_process':
      return TaskStatusEnum.InProgress;
    case 'failed':
      return TaskStatusEnum.Failed;
    case 'finished':
      return TaskStatusEnum.Success;
    default:
      return null;
  }
};

const updateConnectedOnu = curry((commOlt, onuId, dbOlt, commOnu, dbOnu) => reader(({ DB }) => {
  const isNew = isNull(dbOnu);
  const onu = dbOnu || { identification: { site: null }, overview: {}, onu: {}, upgrade: {} };
  const timestamp = new Date().setMilliseconds(0);

  const oldOltId = get(['onu', 'id'], dbOnu);
  if (oldOltId && oldOltId !== dbOlt.identification.id) {
    logDeviceEvent(`ONU: ${onu.identification.name} was moved to OLT ${dbOlt.identification.name}.`,
      LogLevelEnum.Info, LogTypeEnum.DeviceMove, Date.now(), onu.identification);
  }

  onu.id = onuId;
  onu.enabled = commOnu.enabled;
  onu.identification.mac = commOnu.mac_address;
  onu.identification.name = defaultTo('ubnt', commOnu.name);
  onu.identification.id = onuId;
  onu.identification.serialNumber = commOnu.serial_number;
  onu.identification.firmwareVersion = commOnu.firmware_version.replace(/v/g, '');
  onu.identification.model = commOnu.model_name === 'AN5506-01-A1' ? DeviceModelEnum.NanoG : commOnu.model_name;
  const platforms = modelToPlatformIds(onu.identification.model);
  onu.identification.platformId = platforms !== null ? platforms[0] : null;
  onu.identification.timestamp = timestamp;
  onu.identification.authorized = true;
  onu.identification.type = 'onu';
  onu.identification.category = 'optical';

  onu.onu.id = dbOlt.identification.id;
  onu.onu.port = Number(commOnu.olt_port);
  onu.onu.onuId = Number(commOnu.onu_id);
  onu.onu.profile = commOnu.profile;
  onu.onu.wanAddress = commOnu.wanAddress;

  const changedAt = parseChangeAtTime(commOnu);
  if (isUndefined(onu.upgrade)) { onu.upgrade = {} }

  if (changedAt > getOr(0, ['upgrade', 'changedAt'], onu)) {
    onu.upgrade.status = parseUpgradeStatus(getOr(null, ['upgrade_status'], commOnu));
    onu.upgrade.error = getOr(null, ['upgrade_fail_reason'], commOnu);
    onu.upgrade.changedAt = changedAt;
  }

  onu.mode = 'bridge';

  if (commOnu.system) {
    onu.overview.uptime = Number(commOnu.system.uptime);
    onu.overview.cpu = Number(commOnu.system.cpu);
    onu.overview.ram = Number(commOnu.system.mem);
    onu.overview.voltage = Number(commOnu.system.voltage);
    onu.overview.temps = formatHwTemperatures(commOnu.system.temps);
  } else {
    onu.overview.uptime = Number(commOnu.uptime);
    onu.overview.cpu = 0;
    onu.overview.ram = 0;
    onu.overview.voltage = 0;
    onu.overview.temps = {};
  }

  // onu.overview.status = commOnu.status === '1' ? StatusEnum.Active : StatusEnum.Unauthorized;
  const hasConnected = onu.overview.status !== StatusEnum.Active;
  const rxPowerOnu = parseFloat(commOnu.optics.rx_power_onu);
  const txPowerOnu = parseFloat(commOnu.optics.tx_power_onu);
  const biasCurrent = parseFloat(commOnu.optics.bias_current);

  onu.overview.status = StatusEnum.Active;
  onu.overview.locating = false;
  onu.overview.signal = Math.round(rxPowerOnu);
  onu.overview.distance = Number(commOnu.distance);
  onu.overview.transmitPower = txPowerOnu;
  onu.overview.receivePower = rxPowerOnu;
  onu.overview.biasCurrent = biasCurrent;
  onu.overview.txDropped = null;
  onu.overview.rxDropped = null;
  onu.overview.rxErrors = null;
  onu.overview.txErrors = null;
  onu.overview.lastSeen = timestamp;

  onu.interfaces = [
    {
      identification: {
        position: 0,
        type: 'pon',
        name: 'pon0',
        description: null,
      },
      ponAuthentication: {
        authorizationType: (commOnu.psskey && commOnu.psskey.length > 0) ? 'key' : 'noauth',
        logicalID: '',
        logicalPassword: '',
        password: commOnu.psskey,
      },
      ponStatistics: {
        biasCurrent,
        registrationStatus: 'Connected',
        transmitPower: txPowerOnu,
        receivePower: rxPowerOnu,
        distance: onu.overview.distance,
      },
    },
    {
      identification: {
        position: 0,
        type: 'eth',
        name: 'eth0',
        description: null,
      },
    },
  ];

  const statistics = getOnuDataStatistics(commOnu.stats, onu.interfaces[0]);

  onu.interfaces = onu.interfaces.map(assoc('statistics', statistics));
  onu.overview.rxRate = statistics.rxrate;
  onu.overview.txRate = statistics.txrate;
  onu.overview.rxBytes = statistics.rxbytes;
  onu.overview.txBytes = statistics.txbytes;

  if (dbOnu === null) {
    logDeviceInfoEvent(LogTypeEnum.DeviceAppear, onu);
  }

  // device event log
  logDeviceProperties(store, onu, timestamp, {
    [DevicePropertyEnum.Cpu]: onu.overview.cpu,
    [DevicePropertyEnum.Ram]: onu.overview.ram,
  });


  const deviceStat = {
    timestamp,
    weight: 1,
    stats: {
      ram: onu.overview.ram,
      cpu: onu.overview.cpu,
    },
  };

  const interfaceStat = {
    timestamp,
    interfaces: {
      pon0: {
        weight: 1,
        stats: {
          tx_power_onu: txPowerOnu,
          rx_power_onu: rxPowerOnu,
        },
      },
      eth0: {
        weight: 1,
        stats: {
          rx_bps: parseSpeed(commOnu.stats.rx_bps),
          tx_bps: parseSpeed(commOnu.stats.tx_bps),
        },
      },
    },
  };

  const updateOnuStatistics = collectForDevice(onuId, deviceStat)
    .run({ DB, config })
    .then(() => collectForInterfaces(onuId, interfaceStat).run({ DB, config }));

  return Promise.all([updateOnuStatistics, DB.onu.update(onu)])
    .then(() => fromDb({}, onu))
    .then(cata(rejectP, resolveP))
    .then(tap((cmDevice) => {
      if (!hasConnected) { return }

      const { messageHub } = commOlt.server.plugins;
      const { deviceConnected, deviceSaved } = messageHub.messages;

      messageHub.publish(deviceConnected(cmDevice));
      // TODO(michal.sedlak@ubnt.com): For now we only publish deviceSave when isNew
      if (isNew) {
        messageHub.publish(deviceSaved(cmDevice, true));
      }
    }));
}));

const disconnectOnu = curry((commOlt, onuIdMap, oltId, onuId) => reader(({ DB, dal }) => {
  const onu = getOr(null, onuId, onuIdMap);

  if (onu === null || onu.online === 'false') {
    return DB.onu.findById(onuId).then((databaseOnu) => {
      const dbOnu = databaseOnu;
      if (dbOnu) {
        if (dbOnu.onu.id === oltId) {
          const { messageHub } = commOlt.server.plugins;
          const { deviceDisconnected } = messageHub.messages;

          // onu belongs to this olt, so onu is disconnected
          return fromDb({}, dbOnu).cata(rejectP, resolveP)
            .then(map(cmDevice => dal.deviceMetadataRepository
              .findById(cmDevice.identification.id)
              .then(dbDeviceMetadata => mergeM(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata), cmDevice)
                .cata(rejectP, resolveP))
            ))
            .then(deviceDisconnectedAp(Date.now()))
            .then(tap(cmDevice => messageHub.publish(deviceDisconnected(cmDevice))))
            .then(toDb)
            .then(cata(rejectP, resolveP))
            .then(DB.onu.update);
        }
        // remove onu link to previous olt
        return DB.onu.removeOnuFromOlt(assocPath(['olt', 'id'], oltId, dbOnu));
      }

      return null;
    });
  }

  return resolveP();
}));

const updateOnus = curry((commOlt, dbOlt, list, dbOnuIds) => reader(({ DB }) => {
  // disconnect onus missing in get onu list event
  const onuIdMap = keyBy(flow(get('serial_number'), aguid), list);

  // remove onus in unsupported state
  const supportedOnuList = list.filter(onu => (onu.mac_address && onu.serial_number));

  // update
  return allP(dbOnuIds.map(weave(disconnectOnu(commOlt, onuIdMap, dbOlt.identification.id), { DB })))
    .then(() => supportedOnuList.map((eventOnu) => {
      const onuId = aguid(eventOnu.serial_number);
      return DB.onu.findById(onuId).then(weave(updateConnectedOnu(commOlt, onuId, dbOlt, eventOnu), { DB }));
    }))
    .then(allP)
    .then(() => fromDb({}, dbOlt))
    .then(cata(rejectP, resolveP))
    .then(synchronizeSiteStatusByDevice);
}));


const updateOnUnsupportedOnuStatusChange = curry((hasUnsupportedOnu, dbOlt) => reader(
  ({ DB, messageHub }) => {
    if (pathEq(['olt', 'hasUnsupportedOnu'], hasUnsupportedOnu, dbOlt)) { return dbOlt }
    if (hasUnsupportedOnu) {
      messageHub.publish(messageHub.messages.oltGotUnsupportedOnuEvent(dbOlt));
    }

    return flow(assocPath(['olt', 'hasUnsupportedOnu'], hasUnsupportedOnu), DB.olt.update)(dbOlt);
  }
));

/*
 * Event handling
 */

const run = event => reader(({ DB, messageHub }) => {
  const { device: commOlt, payload: { onuList, onuConfig } } = event;
  const oltId = event.id;
  let listRaw = Array.isArray(onuList.GET_ONU_LIST) ? onuList.GET_ONU_LIST : [];
  const hasUnsupportedOnu = containsUnsupportedOnu(listRaw);
  if (hasUnsupportedOnu) { listRaw = listRaw.filter(isOnuSupported) }

  const list = map((rawItem) => {
    const name = path(['serial_number'], rawItem);

    return flow(
      assocPath(['profile'], path(['GET_ONUCFG', 'onu-list', name, 'profile'], onuConfig)),
      assocPath(['wanAddress'], path(['GET_ONUCFG', 'onu-list', name, 'wan-address'], onuConfig)),
      assocPath(['enabled'], pathEq(['GET_ONUCFG', 'onu-list', name, 'disable'], 'false', onuConfig))
    )(rawItem);
  })(listRaw);

  return DB.olt.findById(oltId)
    .then(tapP(when(
      isNotOltUnauthorized,
      dbOlt => DB.onu.findAllIdsByOltId(oltId).then(weave(updateOnus(commOlt, dbOlt, list), { DB }))
    )))
    .then(weave(updateOnUnsupportedOnuStatusChange(hasUnsupportedOnu), { DB, messageHub }));
});

const onuListHandler = ({ deviceId, payload }) => reader(
  ({ messageHub, DB }) => {
    const event = { id: deviceId, device: { server: { plugins: { messageHub } } }, payload };

    return run(event).run({ messageHub, DB });
  }
);

module.exports = onuListHandler;
