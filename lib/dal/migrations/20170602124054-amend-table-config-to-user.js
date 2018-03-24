'use strict';

const { map, isUndefined, get } = require('lodash/fp');
const { merge, omit, when, curry, always } = require('ramda');
const { isNotNull } = require('ramda-adjunct');

const { allP } = require('../../util');
const { TableTypeEnum } = require('../../enums');

/* eslint-disable global-require,no-shadow */
const DB = (function iife() {
  const redis = require('redis');
  const bluebird = require('bluebird');
  const { partial } = require('lodash');
  const { find, flow, get, eq, defaultTo } = require('lodash/fp');
  const host = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
  const port = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;

  const tapP = curry((fn, val) => Promise.resolve(fn(val)).then(always(val)));

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
  const updateUserProfile = partial(insertType, redisClient, 'userProfile');

  getAllUsers();

  return {
    user: {
      list: getAllUsers,
    },
    userProfile: {
      findByUserId: findUserProfileByUserId,
      update: updateUserProfile,
    },
  };
}());
/* eslint-disable global-require,no-shadow */


const userProfilesPromise = DB.user.list()
  .then(map('id'))
  .then(map(DB.userProfile.findByUserId))
  .then(allP);

const tableConfig = {
  [TableTypeEnum.DeviceBackupList]: [
    'name', 'date', 'time',
  ],
  [TableTypeEnum.DeviceInterfaceList]: [
    'status', 'name', 'type', 'ip', 'poe', 'SFP', 'rxrate', 'txrate', 'rxbytes', 'txbytes', 'dropped', 'errors',
  ],
  erouterStaticRoutes: [  // is not in TableTypeEnum
    'type', 'description', 'destination', 'gateway', 'staticType', 'interface', 'distance', 'selected',
  ],
};


const updateTableConfig = (userProfile) => {
  if (isUndefined(get(['tableConfig'], userProfile))) { return null }

  const newUserProfile = userProfile;
  newUserProfile.tableConfig = merge(userProfile.tableConfig, tableConfig);

  return newUserProfile;
};

const resetTableConfig = (userProfile) => {
  if (isUndefined(get(['tableConfig'], userProfile))) { return null }

  const newUserProfile = userProfile;
  newUserProfile.tableConfig = omit([
    'deviceBackupList', 'deviceInterfaceList', 'erouterStaticRoutes',
  ], userProfile.tableConfig);

  return newUserProfile;
};


module.exports = {
  up() {
    return userProfilesPromise
      .then(map(updateTableConfig))
      .then(map(when(isNotNull, DB.userProfile.update)))
      .then(allP);
  },
  down() {
    return userProfilesPromise
      .then(map(resetTableConfig))
      .then(map(when(isNotNull, DB.userProfile.update)))
      .then(allP);
  },
};
