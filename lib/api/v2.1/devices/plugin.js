'use strict';

const joi = require('joi');
const aguid = require('aguid');
const moment = require('moment-timezone');
const { Reader: reader } = require('monet');
const lodash = require('lodash');
const { Observable } = require('rxjs/Rx');
const {
  map, filter, spread, invokeArgs, getOr, find, equals, forEach, mapValues, compact, identity,
  fromPairs, get, values, contains, __, orderBy, head, constant, flatten, update, nth, sortBy,
  curry, flow, partial, toPairs, stubObject, isUndefined, some, omitBy, isNull, tap,
} = require('lodash/fp');
const { when, pathEq, pathSatisfies, always, ifElse, length, comparator, omit, assocPath } = require('ramda');
const { cata, weave } = require('ramda-adjunct');
const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs-extra'));
const targz = require('tar.gz');

const { registerPlugin } = require('../../../util/hapi');
const {
  isNotNull, tapP, entityExistsCheck, toCanonicalKebabCase, allP, resolveP, rejectP,
} = require('../../../util');
const { DB } = require('../../../db');
const validation = require('../../../validation');
const { toDisplayName: toInterfaceDisplayName } = require('../../../transformers/interfaces/utils');
const { StatusEnum, EntityEnum, DeviceTypeEnum, LogTypeEnum } = require('../../../enums');
const {
  writeDeviceBackupFile,
  removeOldDeviceBackupFiles,
  deleteBackupFile,
  getBackupFile,
  getBackupDirName,
  unzipAirMaxBackup,
  getAirMaxBackupWithCrc,
  getBackupWithCrc,
  isDeviceAirMax,
  fromHexString,
} = require('../../../backups/util');
const config = require('../../../../config');
const { toApiUser } = require('../../../transformers/user');
const { supportedStatistics } = require('../../../feature-detection/statistics');
const service = require('./service');
const { fromDbList, fromDb: fromDbDevice } = require('../../../transformers/device');

const { fromDb: fromDbDeviceMetadata } = require('../../../transformers/device/metadata');
const { merge } = require('../../../transformers');
const { mergeMetadata } = require('../../../transformers/device/mergers');

const { emptyDirAsync, writeFileAsync } = fs;


/*
 * Business logic
 */

const getDeviceLatestBackupId = deviceId => DB.device.listBackups(deviceId)
  .then(orderBy('timestamp', 'desc'))
  .then(head)
  .then(getOr(null, ['id']));

const createBackupName = (device, site) => {
  const siteName = get(['identification', 'name'], site);
  const deviceName = get(['identification', 'name'], device);
  const dateTime = moment().format('YYYY-MM-DD-HH-mm-ss');
  const timestamp = Date.now();

  return [siteName, deviceName, dateTime, timestamp].map(toCanonicalKebabCase).join('__');
};

const createBackupAndGetId = deviceId => reader(({ backups, eventLog, deviceStore }) =>
  service.createBackup(deviceId).run({ DB, backups, eventLog, deviceStore })
    .then(() => getDeviceLatestBackupId(deviceId))
);

const createMultiBackup = curry((dirName, dbDevices, sites) => reader(
  ({ deviceStore, backups, eventLog }) => Promise.all(dbDevices.map((dbDevice) => {
    const deviceId = get(['identification', 'id'], dbDevice);
    const siteId = get(['identification', 'site', 'id'], dbDevice);
    const site = find(pathEq(['identification', 'id'], siteId), sites);
    const backupName = createBackupName(dbDevice, site);
    const isAirMax = isDeviceAirMax(dbDevice);
    const unzipIfIsAirMax = isAirMax ? flow(fromHexString, unzipAirMaxBackup) : identity;
    const fileExt = isAirMax ? 'cfg' : 'tar.gz';
    const filePath = `${dirName}/${backupName}.${fileExt}`;

    return getDeviceLatestBackupId(deviceId)
      .then(when(isNull, () => createBackupAndGetId(deviceId).run({ backups, eventLog, deviceStore })))
      .then(getBackupFile(deviceId))
      .then(unzipIfIsAirMax)
      .then(source => writeFileAsync(filePath, source));
  }))
));

// authorizeDevice :: String -> Object -> Object
const authorizeDevice = curry((siteId, dbDevice) => {
  const status = pathEq(['overview', 'status'], StatusEnum.Disconnected, dbDevice)
    ? StatusEnum.Disconnected
    : StatusEnum.Active;

  return flow(
    assocPath(['overview', 'status'], status),
    assocPath(['identification', 'authorized'], true),
    assocPath(['identification', 'site'], { id: siteId })
  )(dbDevice);
});

function aggregateStatisticsIntervals(statisticsIntervals) {
  const entries = {};

  // iterate over all entries in all intervals in statistics
  // and keep only the last entry for each unique timestamp
  statisticsIntervals.forEach(interval =>
    interval.forEach((entry) => {
      entries[entry.timestamp] = entry;
    })
  );
  return values(entries);
}

const normalizeInterfaceStatistics = curry((timestamp, { stats: { rx_bps: rxBps, tx_bps: txBps } }) => {
  if (some(isUndefined, [rxBps, txBps])) { return null }

  return {
    receive: [{ x: timestamp, y: Math.round(rxBps) }],
    transmit: [{ x: timestamp, y: Math.round(txBps) }],
  };
});

const normalizePowerStatistics = curry((timestamp, { stats: { rx_power_onu: rxPower, tx_power_onu: txPower } }) => {
  if (some(isUndefined, [rxPower, txPower])) { return null }

  return {
    receive: [{ x: timestamp, y: Math.round(rxPower) }],
    transmit: [{ x: timestamp, y: Math.round(txPower) }],
  };
});

const concatIfArrayCustomizer = (objValue, srcValue) => {
  if (Array.isArray(objValue)) {
    objValue.push(...srcValue); // using push instead of concat for speed
    return objValue;
  }

  return undefined;
};

const extractStatistics = (accumulator, entry) => {
  if (entry.stats) {
    if (isNotNull(accumulator.cpu)) { accumulator.cpu.push({ x: entry.timestamp, y: Math.round(entry.stats.cpu) }) }
    if (isNotNull(accumulator.ram)) { accumulator.ram.push({ x: entry.timestamp, y: Math.round(entry.stats.ram) }) }
    if (isNotNull(accumulator.ping)) { accumulator.ping.push({ x: entry.timestamp, y: Math.round(entry.stats.ping) }) }
    if (isNotNull(accumulator.signal)) {
      accumulator.signal.push({ x: entry.timestamp, y: Math.round(entry.stats.signal) });
    }
    if (isNotNull(accumulator.remoteSignal)) {
      accumulator.remoteSignal.push({ x: entry.timestamp, y: Math.round(entry.stats.remoteSignal) });
    }
    if (isNotNull(accumulator.errors)) {
      accumulator.errors.push({ x: entry.timestamp, y: Math.round(entry.stats.errors) });
    }
  }

  if (isNotNull(accumulator.power) && entry.interfaces) {
    const powerStatistics = mapValues(normalizePowerStatistics(entry.timestamp), entry.interfaces);
    if (isNotNull(powerStatistics)) {
      // using mutating merge for more speed
      lodash.mergeWith(accumulator.power, powerStatistics, concatIfArrayCustomizer);
    }
  }

  if (isNotNull(accumulator.interfaces) && entry.interfaces) {
    const interfaceStatistics = mapValues(normalizeInterfaceStatistics(entry.timestamp), entry.interfaces);
    if (isNotNull(interfaceStatistics)) {
      // using mutating merge for more speed
      lodash.mergeWith(accumulator.interfaces, interfaceStatistics, concatIfArrayCustomizer);
    }
  }

  return accumulator;
};

const buildSupportedStatistics = flow(
  mapValues(flag => (flag ? [] : null)),
  when(pathSatisfies(isNotNull, ['interfaces']), update('interfaces', stubObject)), // set interfaces to Object
  when(pathSatisfies(isNotNull, ['power']), update('power', stubObject)) // set power to Object
);

const xAxisComparator = comparator((a, b) => a.x < b.x);

const sortStatistics = when(Array.isArray, invokeArgs('sort', [xAxisComparator]));

const transformInterfaceStatisticsObject = dbInterfaceNameDisplayNameMap => flow(
  omitBy(isNull),
  toPairs,
  sortBy(nth(0)), // sort by key
  map(([interfaceName, stats]) => Object.assign(
    mapValues(sortStatistics, stats),
    { name: getOr(interfaceName, interfaceName, dbInterfaceNameDisplayNameMap) }
  ))
);

function transformStatistics(supported, dbInterfaceNameDisplayNameMap, statistics) {
  const statisticsObject = statistics.reduce(extractStatistics, buildSupportedStatistics(supported));
  forEach(sortStatistics, statisticsObject);
  const transformStatisticsObject = transformInterfaceStatisticsObject(dbInterfaceNameDisplayNameMap);

  if (supported.interfaces) {
    statisticsObject.interfaces = transformStatisticsObject(statisticsObject.interfaces);
  }

  if (supported.power) {
    statisticsObject.power = transformStatisticsObject(statisticsObject.power);
  }

  return statisticsObject;
}

const extractInterfaceNameDisplayNamePair = (dbInterface) => {
  const name = get(['identification', 'name'], dbInterface);
  const description = get(['identification', 'description'], dbInterface);
  const type = get(['identification', 'type'], dbInterface);

  return [name, toInterfaceDisplayName({ name, description, type })];
};

const createInterfaceIdToNameMap = flow(
  map(extractInterfaceNameDisplayNamePair),
  fromPairs
);

const insertPeriodAndInterval = curry((interval, statistics) =>
  Object.assign({}, statistics, {
    period: config.statisticsIntervalPeriodMapping[interval],
    interval: {
      start: Date.now() - config.statisticsIntervalLengthMapping[interval],
      end: Date.now(),
    },
  })
);

const canLogDeviceAuthorizeEvent = cmDevice => (
  getOr(null, ['identification', 'siteId'], cmDevice) === null &&
  getOr(null, ['identification', 'type'], cmDevice) !== DeviceTypeEnum.Onu
);

/*
 * Route definitions
 */

function register(server) {
  const { logDeviceInfoEvent, logDeviceMovedEvent, logDeviceAuthorizedEvent } = server.plugins.eventLog;

  server.route({
    method: 'GET',
    path: '/v2.1/devices',
    config: {
      validate: {
        query: {
          siteId: validation.siteId.optional(),
        },
      },
    },
    handler(request, reply) {
      const { firmwareDal, deviceStore, dal } = server.plugins;

      reply(
        service.deviceList(request.query.siteId).run({ DB, deviceStore, firmwareDal, dal })
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{id}',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { dal } = server.plugins;

      reply(
        service.deviceDetail(request.params.id).run({ DB, dal })
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{id}/authorize',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { user, site, dal } = server.plugins;

      const siteId = request.payload.siteId;

      const dbDeviceP = DB.device.findById(request.params.id)
        .then(tapP(entityExistsCheck(EntityEnum.Device)));

      const oldSiteP = dbDeviceP
        .then(getOr(null, ['identification', 'site', 'id']))
        .then(when(isNotNull, DB.site.findById));

      const updateDeviceP = oldSiteP
        .then(constant(dbDeviceP))
        .then(authorizeDevice(siteId))
        .then(tapP(DB.device.update));

      const newSiteP = DB.site.findById(siteId)
        .then(tapP(entityExistsCheck(EntityEnum.Site)));

      const userP = user
        .getUser(request.token.userId)
        .chainEither(toApiUser)
        .promise();

      const dbDeviceMetadataP = dal.deviceMetadataRepository.findById(request.params.id)
        .then(tapP(entityExistsCheck(EntityEnum.DeviceMetadata)));

      const cmDeviceP = allP([dbDeviceP, dbDeviceMetadataP])
        .then(([dbDevice, dbDeviceMetadata]) => fromDbDevice({}, dbDevice)
          .chain(merge(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
          .cata(rejectP, resolveP)
        );

      reply(
        Promise.all([cmDeviceP, userP, newSiteP, updateDeviceP])
          .then(when(
            spread(canLogDeviceAuthorizeEvent),
            spread(logDeviceAuthorizedEvent)
          ))
          .then(() => allP([oldSiteP, newSiteP])
            .then(map(getOr(null, ['identification', 'id'])))
            .then(compact)
            .then(map(site.synchronizeSiteStatus))
            .then(allP)
          )
          .then(constant(Promise.all([cmDeviceP, newSiteP, userP])))
          .then(spread(logDeviceMovedEvent))
          .then(constant({ result: true, message: 'Authorized' }))
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{id}/restart',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { deviceStore, 'apiOnusV2.1': apiOnus, messageHub, user, dal } = server.plugins;
      const { id: deviceId } = request.params;
      const { userId } = request.token;

      reply(
        service.restartDevice(deviceId).run({ DB, deviceStore, apiOnus, userId, messageHub, user, dal })
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{id}/upgrade-to-latest',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { firmwareDal, 'apiTasksV2.1': apiTasks } = server.plugins;
      const { id: deviceId } = request.params;
      const { userId } = request.token;

      reply(
        service.upgradeFirmwareToLatest(userId, deviceId).run({ DB, apiTasks, firmwareDal })
      );
    },
  });


  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const deviceId = request.params.id;
      const { messageHub } = server.plugins;
      const { deviceRemoved } = messageHub.messages;

      const devicePromise = DB.device.findById(deviceId)
        .then(tapP(entityExistsCheck(EntityEnum.Device)));

      const onusPromise = devicePromise
        .then(ifElse(
          pathSatisfies(equals(DeviceTypeEnum.Olt), ['identification', 'type']),
          () => DB.onu.findAllIdsByOltId(deviceId).map(id => DB.onu.findById(id)),
          always([])
        ));

      reply(
        Promise.all([devicePromise, onusPromise])
          .then(flatten)
          .then(tapP(dbDeviceList => allP(dbDeviceList.map(DB.device.remove))))
          .then(fromDbList({}))
          .then(cata(rejectP, resolveP))
          .then(tap(forEach(cmDevice => messageHub.publish(deviceRemoved(cmDevice)))))
          .then(length)
          .then(count => ({ result: true, message: `${count} device(s) deleted` }))
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{id}/refresh',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const deviceId = request.params.id;
      const { macAesKeyStore } = server.plugins;

      reply(
        service.refreshDevice(deviceId).run({ macAesKeyStore })
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{id}/backups',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      reply(
        service.listBackups(request.params.id).run({ DB })
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{id}/statistics',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
        query: {
          interval: validation.interval,
        },
      },
    },
    handler(request, reply) {
      const deviceId = request.params.id;

      const devicePromise = DB.device.findById(deviceId)
        .then(tapP(entityExistsCheck(EntityEnum.Device)));

      const supportedStatisticsPromise = devicePromise
        .then(getOr(null, ['identification', 'model']))
        .then(supportedStatistics);

      const idToNameMapPromise = devicePromise
        .then(getOr([], 'interfaces'))
        .then(createInterfaceIdToNameMap);

      const statisticsPromise = DB.statistics.findByIdAndInterval(deviceId, request.query.interval, Date.now())
        .then(aggregateStatisticsIntervals);

      reply(
        Promise.all([supportedStatisticsPromise, idToNameMapPromise, statisticsPromise])
          .then(spread(transformStatistics))
          .then(insertPeriodAndInterval(request.query.interval))
      );
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/devices/{id}/backups',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { backups, eventLog, deviceStore } = server.plugins;

      reply(
        service.createBackup(request.params.id).run({ DB, backups, eventLog, deviceStore })
      );
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/devices/backups',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: {
          deviceIds: joi.array().items(validation.deviceId).min(1),
        },
      },
    },
    handler(request, reply) {
      const { deviceStore, backups, eventLog } = server.plugins;
      const { deviceIds } = request.payload;

      const dateString = moment().format('YYYY-MM-DD-HH-mm-ss');
      const timestamp = Date.now();
      const dirName = `unms_devices_backup_${dateString}_${timestamp}`;
      const multiBackupDirName = getBackupDirName(config.deviceConfigBackup.multiBackup.dir);
      const backupDir = `${multiBackupDirName}/${dirName}`;

      const devicesPromise = DB.device.list()
        .then(filter(pathSatisfies(contains(__, deviceIds), ['identification', 'id'])));

      const sitesPromise = devicesPromise
        .then(map(get(['identification', 'site', 'id'])))
        .then(siteIds => DB.site.list()
          .then(filter(pathSatisfies(contains(__, siteIds), ['identification', 'id'])))
        );

      const dirPromise = emptyDirAsync(multiBackupDirName)
        .then(() => emptyDirAsync(backupDir));

      reply(
        Promise.all([devicesPromise, sitesPromise, dirPromise])
          .then(spread(weave(createMultiBackup(backupDir), { deviceStore, backups, eventLog })))
          .then(() => targz().createReadStream(backupDir))
      ).type('application/tar+gzip');
    },
  });


  server.route({
    method: 'PUT',
    path: '/v2.1/devices/{id}/backups',
    config: {
      auth: {
        scope: 'admin',
      },
      payload: {
        output: 'file',
        maxBytes: config.deviceConfigBackup.fileMaxBytes,
        parse: true,
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const file = fs.readFileSync(request.payload.file.path).toString('hex');
      const deviceId = request.params.id;
      const backupId = aguid();

      const newBackupPromise = DB.device.findById(deviceId)
        .then(tapP(entityExistsCheck(EntityEnum.Device)))
        .then(ifElse(
          isDeviceAirMax,
          () => getAirMaxBackupWithCrc(file),
          () => getBackupWithCrc(file)
        ))
        .then(writeDeviceBackupFile(getBackupDirName(deviceId), backupId))
        .then(tapP(DB.device.insertBackup(deviceId)));

      const removeOldBackupsPromise = newBackupPromise
        .then(() => DB.device.listBackups(deviceId))
        .then(removeOldDeviceBackupFiles(deviceId));

      reply(
        Promise.all([newBackupPromise, removeOldBackupsPromise])
          .then(head)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{deviceId}/backups/{backupId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          backupId: validation.backupId,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, backupId } = request.params;
      const isDeviceAirMaxP = DB.device.findById(deviceId)
        .then(tapP(entityExistsCheck(EntityEnum.Device)))
        .then(isDeviceAirMax);
      const backupP = isDeviceAirMaxP
        .then(partial(getBackupFile, [deviceId, backupId]));

      reply(
        allP([isDeviceAirMaxP, backupP])
          .then(([isAirMax, backup]) => when(constant(isAirMax), unzipAirMaxBackup)(backup))
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/devices/{deviceId}/backups/{backupId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          backupId: validation.backupId,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, backupId } = request.params;

      reply(
        DB.device.findById(deviceId)
          .then(entityExistsCheck(EntityEnum.Device))
          .then(partial(DB.device.findBackupById, [deviceId, backupId]))
          .then(tapP(entityExistsCheck(EntityEnum.Backup)))
          .then(DB.device.removeBackup(deviceId))
          .then(tapP(partial(deleteBackupFile, [deviceId, backupId])))
          .then(count => ({ result: true, message: `${count} backup file(s) deleted` }))
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/backups/{backupId}/apply',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          backupId: validation.backupId,
        },
      },
    },
    handler(request, reply) {
      const { deviceStore } = server.plugins;
      const { deviceId, backupId } = request.params;

      reply(
        Observable.of(deviceStore.get(deviceId))
          .do(entityExistsCheck(EntityEnum.Device))
          .mergeMap(commDevice => Observable.from(getBackupFile(deviceId, backupId))
            .mergeMap(backupFile => commDevice.applyBackup(backupFile))
            .mergeMap(() => DB.device.findById(commDevice.deviceId)
              .then(logDeviceInfoEvent(LogTypeEnum.DeviceBackupApply))))
          .mapTo({ result: true, message: 'Backup applied' })
          .toPromise()
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{id}/system',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { deviceStore } = server.plugins;
      const deviceId = request.params.id;

      // TODO(michal.sedlak@ubnt.com): Erouter and OLT specific method
      reply(
        service.getSystem(deviceId).run({ deviceStore })
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/{id}/system',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          name: joi.string().min(2).max(63).required(),
          domainName: joi.string().min(2).max(63).allow(null),
          timezone: validation.timezone,
          admin: joi.object().allow(null),
          dns1: joi.string().ip({ version: ['ipv4'] }).allow(null),
          dns2: joi.string().ip({ version: ['ipv4'] }).allow(null),
          gateway: joi.string().ip({ version: ['ipv4'] }).allow(null),
          readOnlyAccount: joi.object().allow(null),
        },
      },
    },
    handler(request, reply) {
      const { deviceStore } = server.plugins;
      const deviceId = request.params.id;

      // TODO(michal.sedlak@ubnt.com): Erouter and OLT specific method
      reply(
        service.setSystem(deviceId, request.payload).run({ deviceStore })
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{id}/system/unms',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { deviceSettings } = server.plugins;
      reply(
        service.getDeviceUnmsSettings(request.params.id).run({ deviceSettings })
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/{id}/system/unms',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.deviceId,
        },
        payload: {
          overrideGlobal: joi.boolean().required(),
          devicePingAddress: validation.devicePingAddress,
          devicePingIntervalNormal: validation.devicePingIntervalNormal,
          devicePingIntervalOutage: validation.devicePingIntervalOutage,
          deviceTransmissionProfile: validation.DeviceTransmissionProfile,
          meta: {
            alias: validation.deviceAlias,
            note: validation.deviceNote,
          },
        },
      },
    },
    handler(request, reply) {
      const { id } = request.params;
      const { deviceStore, deviceSettings, dal } = server.plugins;
      const unmsSettings = omit(['meta'], request.payload);
      const unmsSettingsPromise = service.updateDeviceUnmsSettings(id, unmsSettings)
        .run({ DB, deviceSettings, deviceStore });
      const deviceMetadataPromise = service.updateDeviceSettingsMetadata(id, request.payload.meta).run({ dal });
      reply(
        allP([unmsSettingsPromise, deviceMetadataPromise])
          .then(head)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/{id}/services',
    config: {
      validate: {
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { deviceStore } = server.plugins;
      const deviceId = request.params.id;

      // TODO(michal.sedlak@ubnt.com): Erouter and OLT specific method
      reply(
        service.getServices(deviceId).run({ deviceStore })
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/devices/{id}/services',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        // TODO(michal.sedlak@ubnt.com): Missing payload validation
        params: {
          id: validation.deviceId,
        },
      },
    },
    handler(request, reply) {
      const { deviceStore } = server.plugins;
      const deviceId = request.params.id;

      // TODO(michal.sedlak@ubnt.com): Erouter and OLT specific method
      reply(
        service.setServices(deviceId, request.payload).run({ deviceStore })
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/devices/macs',
    handler(request, reply) {
      reply(
        service.macAddressList().run({ DB })
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/devices/{deviceId}/interfaces/{interfaceName}/resetstats',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          deviceId: validation.deviceId,
          interfaceName: validation.interfaceName,
        },
      },
    },
    handler(request, reply) {
      const { deviceId, interfaceName } = request.params;

      reply(
        service.resetInterfaceStatistics(deviceId, interfaceName).run({ DB })
      );
    },
  });

  server.expose(service);
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'devicesV2.1',
  version: '1.0.0',
  dependencies: [
    'deviceStore', 'firmwareDal', 'apiOnusV2.1', 'apiTasksV2.1', 'messageHub', 'dal', 'user', 'eventLog',
  ],
};
