'use strict';

const { flow, partial, flatten, constant, curry, isNil, assignWith } = require('lodash');
const {
  find, get, getOr, eq, tap, assign, defaultTo, invokeArgs, maxBy, compact, forEach, zip, filter, nth, isNull,
  stubTrue, values,
} = require('lodash/fp');
const { assoc, assocPath, pathEq, pipeP, map, when } = require('ramda');
const { cata } = require('ramda-adjunct');
const redis = require('redis');
const bluebird = require('bluebird');
const crypto = require('crypto');
const aguid = require('aguid');

const { tapP, isNotNull, resolveP, rejectP, allP } = require('../util');
const config = require('../../config');
const {
  MailServerTypeEnum, DeviceTransmissionProfileEnum, DateFormatEnum, TimeFormatEnum, StatusEnum, MapsProviderEnum,
} = require('../enums');
const { fromDbList: fromDbDeviceList, toDb: toDbDevice } = require('../transformers/device');
const { deviceDisconnected: deviceDisconnectedAp } = require('../transformers/device/ap');
const { fromDbList: fromDbSiteList, toDb: toDbSite } = require('../transformers/site');
const logging = require('../logging');


/*
 * Redis client
 */
const throwError = (err) => { throw err };
const logError = message => console.error(message);
const redisClient = redis.createClient({ host: config.redisHost, port: config.redisPort, db: config.redisDb });
const logRedisError = error => logError(`Redis connection error: ${error}`);
redisClient.on('error', flow(tap(logRedisError), throwError));
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);


/*
 * Utils
 */

const TypeEnum = Object.freeze({
  Olt: 'olt',
  User: 'user',
  UserProfile: 'userProfile',
  Token: 'token',
  Nms: 'nms',
  Onu: 'onu',
  PasswordToken: 'passwordToken', // temporary token for password reset
  TwoFactorToken: 'twoFactorToken', // temporary token for two factor authentication
  Erouter: 'erouter',
  Eswitch: 'eswitch',
  AirCube: 'airCube',
  AirMax: 'airMax',
  Site: 'site',
  Statistics: 'statistics',
});

const mhgetall = (keys, callback) => {
  const batch = redisClient.batch();
  keys.forEach(key => batch.get(key));
  batch.exec((err, results) => callback(err, results));
};

const getAllTypes = (db, type, fmap = JSON.parse) => {
  let result = [];
  let cursor = '0';
  const scanTypes = (callback) => {
    db.scan(cursor, 'MATCH', `${type}:*`, 'COUNT', '100', (err, res) => {
      if (err) { return callback(err, null) }
      cursor = res[0];
      result = result.concat(res[1]);
      if (cursor !== '0') return scanTypes(callback);
      return callback(null, result);
    });
  };

  return new Promise((resolve, reject) => {
    scanTypes((err1, res1) => {
      if (err1) { return reject(err1) }

      return mhgetall(res1, (err2, res2) => {
        if (err2) {
          return reject(err2);
        }
        return resolve(res2.map(fmap));
      });
    });
  });
};

const findTypeById = (db, type, id, fmap = JSON.parse) => db.getAsync(`${type}:${id}`).then(fmap);

const findTypeByProperty = (db, type, propertyName, propertyValue, fmap = JSON.parse) =>
  getAllTypes(db, type, fmap)
    .then(find(flow(get(propertyName), eq(propertyValue))))
    .then(defaultTo(null));

const id2Type = id => redisClient.hgetAsync('id2type', id);

const ids2Types = ids => redisClient.hmgetAsync('id2type', ids);

const insertType = (db, type, obj, fmap = JSON.stringify) =>
  db.setAsync(`${type}:${obj.id}`, fmap(obj))
    .then(tapP(() => db.hsetAsync('id2type', obj.id, type)))
    .then(eq('OK'));

const removeTypeById = (db, type, id) =>
  db.delAsync(`${type}:${id}`)
    .then(tapP(() => db.hdelAsync('id2type', id)));

const cleanType = (db, type) =>
  db.evalAsync(
    "for i, name in ipairs(redis.call('KEYS', ARGV[1])) do redis.call('DEL', name); end", 0, `${type}:*`
  ).then(stubTrue);

const addItemToSet = (db, setId, item) => db.saddAsync(setId, item);

const statisticsKey = (intervalName, deviceId) => `statistics-${intervalName}:${deviceId}`;

// multiplied by 1.1 to retrieve older stats to not trim the left side of the charts
const isStatisticsInInterval = (intervalName, time) => stat =>
  time - (config.statisticsIntervals[intervalName].length * 1.1) < stat.timestamp;

function findStatisticsByIdAndInterval(id, intervalEnum, time) {
  const batch = redisClient.batch();
  const statisticsIntervalNames = config.statisticsIntervalMapping[intervalEnum];
  if (!statisticsIntervalNames) throw Error('Invalid interval');

  statisticsIntervalNames.forEach(intervalName => batch.lrange(statisticsKey(intervalName, id), 0, -1));

  return batch.execAsync()
    .then(results => results.map(result => result.map(JSON.parse)))
    .then(results => results.map((result, i) =>
      result.filter(isStatisticsInInterval(statisticsIntervalNames[i], time))));
}

function getLastStatisticsItem(intervalName, deviceId) {
  return redisClient.lpopAsync(statisticsKey(intervalName, deviceId)).then(JSON.parse);
}

function updateStatistics(updates) {
  const batch = redisClient.batch();
  updates.toAdd.forEach(i => batch.lpush(statisticsKey(i.intervalName, i.deviceId), i.stats.map(JSON.stringify)));
  updates.toTrim.forEach(i => batch.ltrim(statisticsKey(i.intervalName, i.deviceId), 0, i.count - 1));
  return batch.execAsync();
}

const deleteStatistics = (intervalName, deviceId) => redisClient.delAsync(statisticsKey(intervalName, deviceId));

// TODO(jan.beseda@ubnt.com): remove once we stop support V1 socket protocol
const toOldProtocolValidKey = key => key.replace(/\+/g, 'A').replace(/\//g, 'B');

/*
 * Indexes
 */

// addOnuToOltSet :: Object -> Promise(Number)
const addOnuToOltSet = onu => addItemToSet(redisClient, `oltSet${onu.onu.id}`, onu.id);
// removeOnuFromOltSet :: Object -> Promise(Number)
const removeOnuFromOltSet = onu => redisClient.sremAsync(`oltSet${onu.onu.id}`, onu.id);

/*
 * Lifting
 */

const lift = (action, ...indexModifiers) => (obj) => {
  const actionPromise = action(obj);
  const modifiersPromise = actionPromise
    .then(constant(indexModifiers))
    .then(map(invokeArgs('call', [null, obj])))
    .then(promises => Promise.all(promises));

  return Promise.all([actionPromise, modifiersPromise]).then(actionPromise);
};

/*
 * Password tokens Dal
 */

// getAllPasswordTokens :: () -> Promise([Object])
const getAllPasswordTokens = partial(getAllTypes, redisClient, TypeEnum.PasswordToken);
// findPasswordTokenById :: String -> Promise(Object)
const findPasswordTokenById = partial(findTypeById, redisClient, TypeEnum.PasswordToken);
// insertPasswordToken :: Object -> Promise(Boolean)
const insertPasswordToken = partial(insertType, redisClient, TypeEnum.PasswordToken);
// removePasswordTokenById :: String -> Promise(Number)
const removePasswordTokenById = partial(removeTypeById, redisClient, TypeEnum.PasswordToken);
// removePasswordToken :: Object -> Promise(Number)
const removePasswordToken = flow(get('id'), removePasswordTokenById);

/*
 * Two Factor Authorization tokens Dal
 */

// findTwoFactorTokenById :: String -> Promise(Object)
const findTwoFactorTokenById = partial(findTypeById, redisClient, TypeEnum.TwoFactorToken);
// insertTwoFactorToken :: Object -> Promise(Boolean)
const insertTwoFactorToken = partial(insertType, redisClient, TypeEnum.TwoFactorToken);
// removeTwoFactorTokenById :: String -> Promise(Number)
const removeTwoFactorTokenById = partial(removeTypeById, redisClient, TypeEnum.TwoFactorToken);
// removeTwoFactorToken :: Object -> Promise(Number)
const removeTwoFactorToken = flow(get('id'), removeTwoFactorTokenById);

/*
 * OLT Dal
 */

// findOltById :: String -> Promise(Object)
const findOltById = partial(findTypeById, redisClient, TypeEnum.Olt);
// getAllOlts :: () -> Promise([Object])
const getAllOlts = partial(getAllTypes, redisClient, TypeEnum.Olt);
// insertOlt :: Object -> Promise(Boolean)
const insertOlt = partial(insertType, redisClient, TypeEnum.Olt);
// removeOltById :: String -> Promise(Number)
const removeOltById = partial(removeTypeById, redisClient, TypeEnum.Olt);
// removeOlt :: Object -> Promise(Number)
const removeOlt = flow(get('id'), removeOltById);
// cleanOlts :: () -> Promise(Boolean)
const cleanOlts = partial(cleanType, redisClient, TypeEnum.Olt);

/*
 * ONU Dal
 */

// getAllOnus :: () => Promise([Object])
const getAllOnus = partial(getAllTypes, redisClient, TypeEnum.Onu);
// findAllOnus :: ({ oltId: string }) => Promise([Object])
const findAllOnus = ({ oltId = null }) => {
  if (isNull(oltId)) { return getAllOnus() }

  return pipeP(getAllOnus, filter(pathEq(['onu', 'id'], oltId)))();
};
// findAllOnuIdsByOltId :: String -> Promise([String])
const findAllOnuIdsByOltId = oltId => redisClient.smembersAsync(`oltSet${oltId}`);
// findErouterById :: String -> Promise(Object)
const findOnuById = partial(findTypeById, redisClient, TypeEnum.Onu);
// insertOnu :: Object -> Promise(Boolean)
const insertOnu = partial(insertType, redisClient, TypeEnum.Onu);
// insertOnuLifted :: Object -> Promise(Boolean)
const insertOnuLifted = lift(insertOnu, addOnuToOltSet);
// removeOnuById :: String -> Promise(Number)
const removeOnuById = partial(removeTypeById, redisClient, TypeEnum.Onu);
// removeOnu :: Object -> Promise(Number)
const removeOnu = flow(get('id'), removeOnuById);
// removeOnuLifter :: Object -> Promise(Number)
const removeOnuLifted = lift(removeOnu, removeOnuFromOltSet);
// cleanOnus :: () -> Promise(Boolean)
const cleanOnus = partial(cleanType, redisClient, TypeEnum.Onu);


/*
 * Erouter Dal
 */

// getAllErouters :: () => Promise([Object])
const getAllErouters = partial(getAllTypes, redisClient, TypeEnum.Erouter);
// findErouterById :: String -> Promise(Object)
const findErouterById = partial(findTypeById, redisClient, TypeEnum.Erouter);
// insertErouter :: Object -> Promise(Boolean)
const insertErouter = partial(insertType, redisClient, TypeEnum.Erouter);
// removeErouterById :: String -> Promise(Number)
const removeErouterById = partial(removeTypeById, redisClient, TypeEnum.Erouter);
// removeErouter :: Object -> Promise(Number)
const removeErouter = flow(get('id'), removeErouterById);
// cleanErouters :: () -> Promise(Boolean)
const cleanErouters = partial(cleanType, redisClient, TypeEnum.Erouter);

/**
 * Eswitch Dal
 */

// getAllEswitches :: () => Promise([Object])
const getAllEswitches = partial(getAllTypes, redisClient, TypeEnum.Eswitch);
// findErouterById :: String -> Promise(Object)
const findEswitchById = partial(findTypeById, redisClient, TypeEnum.Eswitch);
// insertEswitch :: Object -> Promise(Boolean)
const insertEswitch = partial(insertType, redisClient, TypeEnum.Eswitch);
// removeEswitchById :: String -> Promise(Number)
const removeEswitchById = partial(removeTypeById, redisClient, TypeEnum.Eswitch);
// removeEswitch :: Object -> Promise(Number)
const removeEswitch = flow(get('id'), removeEswitchById);
// cleanEswitches :: () -> Promise(Boolean)
const cleanEswitches = partial(cleanType, redisClient, TypeEnum.Eswitch);


/**
 * AirCube Dal
 */
// getAllAirCubes :: () => Promise([Object])
const getAllAirCubes = partial(getAllTypes, redisClient, TypeEnum.AirCube);
// findAirCubeById :: String -> Promise(Object)
const findAirCubeById = partial(findTypeById, redisClient, TypeEnum.AirCube);
// insertAirCube :: Object -> Promise(Boolean)
const insertAirCube = partial(insertType, redisClient, TypeEnum.AirCube);
// removeAirCubeById :: String -> Promise(Number)
const removeAirCubeById = partial(removeTypeById, redisClient, TypeEnum.AirCube);
// removeAirCube :: Object -> Promise(Number)
const removeAirCube = flow(get('id'), removeAirCubeById);
// cleanAirCubes :: () -> Promise(Boolean)
const cleanAirCubes = partial(cleanType, redisClient, TypeEnum.AirCube);

/**
 * AirMax Dal
 */
// getAllAirMaxes :: () => Promise([Object])
const getAllAirMaxes = partial(getAllTypes, redisClient, TypeEnum.AirMax);
// findAirMaxById :: String -> Promise(Object)
const findAirMaxById = partial(findTypeById, redisClient, TypeEnum.AirMax);
// insertAirMax :: Object -> Promise(Boolean)
const insertAirMax = partial(insertType, redisClient, TypeEnum.AirMax);
// removeAirMaxById :: String -> Promise(Number)
const removeAirMaxById = partial(removeTypeById, redisClient, TypeEnum.AirMax);
// removeAirMax :: Object -> Promise(Number)
const removeAirMax = flow(get('id'), removeAirMaxById);
// cleanAirMaxes :: () -> Promise(Boolean)
const cleanAirMaxes = partial(cleanType, redisClient, TypeEnum.AirMax);

/*
 * Token Dal
 */

// getAllTokens :: () -> Promise([Object])
const getAllTokens = partial(getAllTypes, redisClient, TypeEnum.Token);
// findTokenById :: String -> Promise(Object)
const findTokenById = partial(findTypeById, redisClient, TypeEnum.Token);
// insertToken :: Object -> Promise(Boolean)
const insertToken = partial(insertType, redisClient, TypeEnum.Token);
// removeTokenById :: String -> Promise(Number)
const removeTokenById = partial(removeTypeById, redisClient, TypeEnum.Token);
// removeToken :: Object -> Promise(Number)
const removeToken = flow(get('id'), removeTokenById);
// findUserTokenByUserId :: String -> Promise(Object)
const findUserTokenByUserId = partial(findTypeByProperty, redisClient, TypeEnum.Token, 'userId');

/*
 * Nms Dal
 */

// configAssigner :: (a, b) -> a | b
const configAssigner = (val, defaultVal) => (isNil(val) ? defaultVal : val);

// getDefaultNmsSettings :: nmsConfig -> defaultNmsConfig
const getDefaultNmsSettings = nms => ({
  isConfigured: false,
  instanceId: aguid(),
  aesKey: toOldProtocolValidKey(crypto.randomBytes(36).toString('base64')),
  autoBackups: true,
  smtp: { type: MailServerTypeEnum.NoSmtp },
  deviceLog: {},
  devicePingAddress: nms ? nms.hostname : null,
  devicePingIntervalNormal: 30000,
  devicePingIntervalOutage: 5000,
  deviceTransmissionProfile: DeviceTransmissionProfileEnum.Medium,
  useLetsEncrypt: true,
  eula: {
    email: null,
    timestamp: null,
  },
  letsEncryptError: null,
  letsEncryptTimestamp: null,
  allowLoggingToSentry: true,
  allowLoggingToLogentries: true,
  maps: {
    provider: MapsProviderEnum.OpenStreetMap,
    googleMapsApiKey: null,
  },
  outages: {
    defaultGracePeriod: 30000,
    upgradeGracePeriod: 300000,
    restartGracePeriod: 300000,
  },
  locale: {
    longDateFormat: {
      LT: TimeFormatEnum[0],
      LL: DateFormatEnum[0],
    },
  },
});

// getNms :: () -> Promise(Object)
const getNms = () => findTypeById(redisClient, TypeEnum.Nms, TypeEnum.Nms)
  .then(nms => assignWith(nms || {}, getDefaultNmsSettings(nms), configAssigner));

// insertNms :: Object -> Promise(Boolean)
const insertNms = flow(assign({ id: TypeEnum.Nms }), partial(insertType, redisClient, TypeEnum.Nms));
// removeNms :: () -> Promise(Number)
const removeNms = partial(removeTypeById, redisClient, TypeEnum.Nms, TypeEnum.Nms);

/*
 * Backups/Restore mechanism
 */

const flushRedis = () => redisClient.flushallAsync();

/*
 * Devices Dal
 */

// findDeviceById :: String -> Promise(Object)
const findDeviceById = deviceId =>
  id2Type(deviceId)
    .then((type) => {
      switch (type) {
        case TypeEnum.Onu:
          return findOnuById(deviceId);
        case TypeEnum.Olt:
          return findOltById(deviceId);
        case TypeEnum.Erouter:
          return findErouterById(deviceId);
        case TypeEnum.Eswitch:
          return findEswitchById(deviceId);
        case TypeEnum.AirCube:
          return findAirCubeById(deviceId);
        case TypeEnum.AirMax:
          return findAirMaxById(deviceId);
        default:
          throw new Error(`Unknown device type: ${type}`);
      }
    });

const deviceIdExists = deviceId => id2Type(deviceId)
  .then(isNotNull);

const deviceIdsExist = deviceIds => ids2Types(deviceIds)
  .then(flow(
    zip(deviceIds),
    filter(flow(nth(1), isNotNull)),
    map(nth(0)),
    defaultTo([])
  ));

// getAllDevices :: () -> Promise([Object])
const getAllDevices = () => Promise.all([
  getAllOlts(),
  getAllErouters(),
  getAllEswitches(),
  getAllOnus(),
  getAllAirCubes(),
  getAllAirMaxes(),
]).then(flatten);

const findAllDevices = ({ siteId = null } = {}) => {
  if (isNull(siteId)) { return getAllDevices() }

  return pipeP(getAllDevices, filter(pathEq(['identification', 'site', 'id'], siteId)))();
};

// removeDevice :: Object -> Promise(Number)
const removeDevice = device =>
  id2Type(device.id)
    .then((type) => {
      switch (type) {
        case TypeEnum.Onu:
          return removeOnuLifted(device);
        case TypeEnum.Olt:
          return removeOlt(device);
        case TypeEnum.Erouter:
          return removeErouter(device);
        case TypeEnum.Eswitch:
          return removeEswitch(device);
        case TypeEnum.AirCube:
          return removeAirCube(device);
        case TypeEnum.AirMax:
          return removeAirMax(device);
        default:
          throw new Error(`Unknown device type: ${type}`);
      }
    });
// insertDevice :: String -> Promise(Number)
const insertDevice = device =>
  id2Type(device.id)
    .then((type) => {
      switch (type) {
        case TypeEnum.Onu:
          return insertOnuLifted(device);
        case TypeEnum.Olt:
          return insertOlt(device);
        case TypeEnum.Erouter:
          return insertErouter(device);
        case TypeEnum.Eswitch:
          return insertEswitch(device);
        case TypeEnum.AirCube:
          return insertAirCube(device);
        case TypeEnum.AirMax:
          return insertAirMax(device);
        default:
          throw new Error(`Unknown device type: ${type}`);
      }
    });
// insertBackup :: String -> Object -> Promise(String)
const insertBackup = curry(
  (deviceId, backup) => redisClient.hsetAsync(`config_backup:${deviceId}`, backup.id, JSON.stringify(backup))
);
// getAllBackups :: String -> Promise(Number)
const getAllBackups = deviceId => redisClient.hgetallAsync(`config_backup:${deviceId}`)
  .then(when(isNotNull, flow(values, map(JSON.parse))));
// removeAllBackups :: String -> Promise(Number)
const removeAllBackups = deviceId => redisClient.delAsync(`config_backup:${deviceId}`);
// removeBackup :: String, Object -> Promise(Number)
const removeBackup = curry(
  (deviceId, backup) => redisClient.hdelAsync(`config_backup:${deviceId}`, get('id', backup))
);
// findBackupById ::
const findBackupById = (deviceId, backupId) =>
  redisClient.hgetAsync(`config_backup:${deviceId}`, backupId).then(JSON.parse);

// sites Dal
// ---------------
// getAllSites :: () => Promise([Object])
const getAllSites = partial(getAllTypes, redisClient, TypeEnum.Site);
// findSiteById :: String -> Promise(Object)
const findSiteById = partial(findTypeById, redisClient, TypeEnum.Site);
// removeSiteById :: Number -> Promise(Number)
const removeSiteById = partial(removeTypeById, redisClient, TypeEnum.Site);
// removeSite :: Object -> Promise(Number)
const removeSite = flow(get('id'), removeSiteById);
// insertSite :: Object -> Promise(Number)
const insertSite = partial(insertType, redisClient, TypeEnum.Site);
// insertImage :: String -> Object -> Promise(String)
const insertImage = curry(
  (siteId, image) => redisClient.hsetAsync(`site_images:${siteId}`, image.id, JSON.stringify(image))
);
// listImages :: String -> Promise(Number)
const listImages = siteId => redisClient.hgetallAsync(`site_images:${siteId}`)
  .then(when(isNotNull, flow(values, map(JSON.parse))));
// findImageById :: String, String -> Promise(Object)
const findImageById = (siteId, imageId) =>
  redisClient.hgetAsync(`site_images:${siteId}`, imageId).then(JSON.parse);
// removeImage :: String, Object -> Promise(Number)
const removeImage = curry(
  (siteId, image) => redisClient.hdelAsync(`site_images:${siteId}`, get('id', image))
);
const moveImage = curry((currentOrder, nextOrder, image) => {
  if (image.order === currentOrder) {
    return assoc('order', nextOrder, image);
  } else if (currentOrder < nextOrder && image.order > currentOrder && image.order <= nextOrder) {
    return assoc('order', image.order - 1, image);
  } else if (image.order < currentOrder && image.order >= nextOrder) {
    return assoc('order', image.order + 1, image);
  }

  return null; // return null if we don't move the image
});
const reorderImage = curry((currentOrder, nextOrder, siteId) => {
  const batch = redisClient.batch();

  return listImages(siteId)
    .then(map(moveImage(currentOrder, nextOrder)))
    .then(compact)
    .then(forEach((image) => { batch.hset(`site_images:${siteId}`, image.id, JSON.stringify(image)) }))
    .then(() => batch.execAsync())
    ;
});
// getMaxImageOrderNumber :: String -> Promise(Number)
const getMaxImageOrderNumber = siteId => listImages(siteId).then(maxBy('order')).then(getOr(0, 'order'));

/*
 * Initializers
 */
const initNms = () => getNms()
  .then((nms) => {
    if (nms !== null) { return null }

    return insertNms({
      isConfigured: false,
      aesKey: toOldProtocolValidKey(crypto.randomBytes(36).toString('base64')),
      autoBackups: true,
      smtp: { type: MailServerTypeEnum.NoSmtp },
    });
  });

const synchronizeOnusStatus = () => getAllOnus()
  .then(fromDbDeviceList({}))
  .then(cata(rejectP, resolveP))
  .then(map(deviceDisconnectedAp(Date.now())))
  .then(map(toDbDevice))
  .then(map(cata(rejectP, resolveP)))
  .then(allP)
  .then(map(insertDevice))
  .then(allP)
  .catch(error => logging.error('Failed to synchronize onus status on DB init', error));

const synchronizeSitesStatus = () => getAllSites()
  .then(fromDbSiteList({}))
  .then(cata(rejectP, resolveP))
  .then(filter(pathEq(['identification', 'status'], StatusEnum.Active)))
  .then(map(assocPath(['identification', 'status'], StatusEnum.Disconnected)))
  .then(map(toDbSite))
  .then(map(cata(rejectP, resolveP)))
  .then(allP)
  .then(map(insertSite))
  .then(allP)
  .catch(error => logging.error('Failed to synchronize sites status on DB init', error));

const initialize = () => allP([initNms(), synchronizeOnusStatus(), synchronizeSitesStatus()]);


/*
 * Module
 */
/**
 * @typedef {Object} DB
 * @property {RedisClient} redis
 * @property {Object} devices
 * @property {Object} passwordToken
 * @property {Function} passwordToken.list
 * @property {Function} passwordToken.findById
 * @property {Function} passwordToken.insert
 * @property {Function} passwordToken.remove
 * @property {Object} twoFactorToken
 * @property {Function} twoFactorToken.findById
 * @property {Function} twoFactorToken.insert
 * @property {Function} twoFactorToken.remove
 * @property {Object} olt
 * @property {Function} olt.list
 * @property {Function} olt.findById
 * @property {Function} olt.insert
 * @property {Function} olt.update
 * @property {Function} olt.remove
 * @property {Function} olt.clean
 * @property {Object} device
 * @property {Function} device.removeAllBackups
 * @property {Function} device.removeBackup
 * @property {Function} device.findBackupById
 * @property {Function} device.insertBackup
 * @property {Function} device.deviceIdsExist
 * @property {Function} device.findById
 * @property {Function} device.list
 * @property {Function} device.findAll
 * @property {Function} device.insert
 * @property {Function} device.update
 * @property {Function} device.remove
 * @property {Function} device.listBackups
 * @property {Object} erouter
 * @property {Function} erouter.list
 * @property {Function} erouter.findById
 * @property {Function} erouter.insert
 * @property {Function} erouter.update
 * @property {Function} erouter.remove
 * @property {Function} erouter.clean
 * @property {Object} eswitch
 * @property {Function} eswitch.list
 * @property {Function} eswitch.findById
 * @property {Function} eswitch.insert
 * @property {Function} eswitch.update
 * @property {Function} eswitch.remove
 * @property {Function} eswitch.clean
 * @property {Object} airCube
 * @property {Function} airCube.list
 * @property {Function} airCube.findById
 * @property {Function} airCube.insert
 * @property {Function} airCube.update
 * @property {Function} airCube.remove
 * @property {Function} airCube.clean
 * @property {Object} airMax
 * @property {Function} airMax.list
 * @property {Function} airMax.findById
 * @property {Function} airMax.insert
 * @property {Function} airMax.update
 * @property {Function} airMax.remove
 * @property {Function} airMax.clean
 * @property {Object} onu
 * @property {Object} user
 * @property {Object} userProfile
 * @property {Object} token
 * @property {Object} nms
 * @property {Object} site
 * @property {Object} statistics
 */
module.exports.DB = {
  redis: redisClient,
  initialize,
  passwordToken: {
    list: getAllPasswordTokens,
    findById: findPasswordTokenById,
    insert: insertPasswordToken,
    remove: removePasswordToken,
  },
  twoFactorToken: {
    findById: findTwoFactorTokenById,
    insert: insertTwoFactorToken,
    remove: removeTwoFactorToken,
  },
  olt: {
    list: getAllOlts,
    findById: findOltById,
    insert: insertOlt,
    update: insertOlt,
    remove: removeOlt,
    clean: cleanOlts,
  },
  device: {
    removeAllBackups,
    removeBackup,
    findBackupById,
    insertBackup,
    deviceIdsExist,
    exists: deviceIdExists,
    findAll: findAllDevices,
    findById: findDeviceById,
    list: getAllDevices,
    insert: insertDevice,
    update: insertDevice,
    remove: removeDevice,
    listBackups: getAllBackups,

  },
  erouter: {
    list: getAllErouters,
    findById: findErouterById,
    insert: insertErouter,
    update: insertErouter,
    remove: removeErouter,
    clean: cleanErouters,
  },
  eswitch: {
    list: getAllEswitches,
    findById: findEswitchById,
    insert: insertEswitch,
    update: insertEswitch,
    remove: removeEswitch,
    clean: cleanEswitches,
  },
  airCube: {
    list: getAllAirCubes,
    findById: findAirCubeById,
    insert: insertAirCube,
    update: insertAirCube,
    remove: removeAirCube,
    clean: cleanAirCubes,
  },
  airMax: {
    list: getAllAirMaxes,
    findById: findAirMaxById,
    insert: insertAirMax,
    update: insertAirMax,
    remove: removeAirMax,
    clean: cleanAirMaxes,
  },
  onu: {
    findAll: findAllOnus,
    list: getAllOnus,
    findById: findOnuById,
    findAllIdsByOltId: findAllOnuIdsByOltId,
    insert: insertOnuLifted,
    update: insertOnuLifted,
    remove: removeOnuLifted,
    removeOnuFromOlt: removeOnuFromOltSet,
    clean: cleanOnus,
  },
  token: {
    list: getAllTokens,
    findById: findTokenById,
    insert: insertToken,
    update: insertToken,
    remove: removeToken,
    findByUserId: findUserTokenByUserId,
  },
  nms: {
    flushRedis,
    get: getNms,
    insert: insertNms,
    update: insertNms,
    remove: removeNms,
  },
  site: {
    insertImage,
    listImages,
    findImageById,
    removeImage,
    getMaxImageOrderNumber,
    reorderImage,
    updateImage: insertImage,
    list: getAllSites,
    findById: findSiteById,
    remove: removeSite,
    insert: insertSite,
    update: insertSite,
  },
  statistics: {
    update: updateStatistics,
    getLastItem: getLastStatisticsItem,
    findByIdAndInterval: findStatisticsByIdAndInterval,
    delete: deleteStatistics,
  },
};
