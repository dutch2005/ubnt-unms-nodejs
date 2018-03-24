'use strict';

const { map, isUndefined, get, getOr } = require('lodash/fp');
const { mergeAll, omit, dissocPath } = require('ramda');

const { allP } = require('../../util');
const { TableTypeEnum } = require('../../enums');

/* eslint-disable global-require,no-shadow */
const DB = (function iife() {
  const redis = require('redis');
  const bluebird = require('bluebird');
  const { partial } = require('lodash');
  const { find, flow, get, eq, defaultTo, constant } = require('lodash/fp');
  const host = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
  const port = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;

  const tapP = (fn, val) => Promise.resolve(fn(val)).then(constant(val));

  const redisClient = redis.createClient({ host, port });
  bluebird.promisifyAll(redis.RedisClient.prototype);

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

  const insertType = (db, type, obj, fmap = JSON.stringify) =>
    db.setAsync(`${type}:${obj.id}`, fmap(obj))
      .then(tapP(() => db.hsetAsync('id2type', obj.id, type)))
      .then(eq('OK'));

  const findTypeByProperty = (db, type, propertyName, propertyValue, fmap = JSON.parse) =>
    getAllTypes(db, type, fmap)
      .then(find(flow(get(propertyName), eq(propertyValue))))
      .then(defaultTo(null));

  const getAllUsers = partial(getAllTypes, redisClient, 'user');
  const findUserProfileByUserId = partial(findTypeByProperty, redisClient, 'userProfile', 'userId');
  const insertUserProfile = partial(insertType, redisClient, 'userProfile');

  return {
    user: {
      list: getAllUsers,
    },
    userProfile: {
      findByUserId: findUserProfileByUserId,
      insert: insertUserProfile,
      update: insertUserProfile,
    },
  };
}());
/* eslint-disable global-require,no-shadow */

const userProfilesPromise = DB.user.list()
  .then(map('id'))
  .then(map(DB.userProfile.findByUserId))
  .then(allP);

const tableConfig = {
  [TableTypeEnum.ErouterStaticRouteList]: [
    'type', 'description', 'destination', 'gateway', 'staticType', 'interface', 'distance', 'selected',
  ],
  [TableTypeEnum.ErouterOspfRouteAreaList]: [
    'id', 'type', 'networks',
  ],
  [TableTypeEnum.ErouterOspfRouteInterfaceList]: [
    'displayName', 'auth', 'cost',
  ],
  [TableTypeEnum.ErouterDhcpLeaseList]: [
    'type', 'ipAddress', 'macAddress', 'expiration', 'serverName', 'leaseId', 'hostname',
  ],
  [TableTypeEnum.ErouterDhcpServerList]: [
    'status', 'name', 'interface', 'rangeStart', 'rangeEnd', 'poolSize', 'available', 'leases',
  ],
  [TableTypeEnum.DeviceLogList]: [
    'level', 'event', 'date', 'time',
  ],
  [TableTypeEnum.SiteDeviceList]: [
    'status', 'name', 'firmwareVersion', 'model', 'uptime', 'lastSeen', 'cpu', 'signal',
  ],
  [TableTypeEnum.SiteEndpointList]: [
    'name', 'status',
  ],
  [TableTypeEnum.OltOnuList]: [
    'status', 'port', 'name', 'model', 'firmwareVersion', 'serialNumber', 'uptime', 'txRate', 'rxRate', 'distance',
    'signal',
  ],
};

const updateTableConfig = (userProfile) => {
  if (isUndefined(get(['tableConfig'], userProfile))) { return null }

  const newUserProfile = userProfile;
  const erouterStaticRouteList = getOr(
    tableConfig[TableTypeEnum.ErouterStaticRouteList], ['tableConfig', 'erouterStaticRoutes'], userProfile
  );

  newUserProfile.tableConfig = mergeAll([
    dissocPath(['erouterStaticRoutes'], userProfile.tableConfig),
    tableConfig,
    { [TableTypeEnum.ErouterStaticRouteList]: erouterStaticRouteList },
  ]);

  return newUserProfile;
};

const resetTableConfig = (userProfile) => {
  if (isUndefined(get(['tableConfig'], userProfile))) { return null }

  const newUserProfile = userProfile;
  newUserProfile.tableConfig = omit([
    TableTypeEnum.ErouterStaticRouteList, TableTypeEnum.ErouterOspfRouteAreaList,
    TableTypeEnum.ErouterOspfRouteInterfaceList, TableTypeEnum.ErouterDhcpLeaseList, TableTypeEnum.SiteDeviceList,
    TableTypeEnum.ErouterDhcpServerList, TableTypeEnum.DeviceLogList, TableTypeEnum.SiteEndpointList,
    TableTypeEnum.OltOnuList,
  ], userProfile.tableConfig);

  return newUserProfile;
};


module.exports = {
  up() {
    return userProfilesPromise
      .then(map(updateTableConfig))
      .then(map(DB.userProfile.update))
      .then(allP);
  },
  down() {
    return userProfilesPromise
      .then(map(resetTableConfig))
      .then(map(DB.userProfile.update))
      .then(allP);
  },
};
