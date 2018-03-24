'use strict';

const { map } = require('lodash/fp');
const { assoc, dissoc } = require('ramda');

const { allP } = require('../../util');
const { TableTypeEnum } = require('../../enums');

/* eslint-disable global-require */
const DB = (function iife() {
  const redis = require('redis');
  const bluebird = require('bluebird');
  const { partial } = require('lodash');
  const { find, flow, get, eq, defaultTo } = require('lodash/fp');
  const host = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
  const port = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;

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

  const findTypeByProperty = (db, type, propertyName, propertyValue, fmap = JSON.parse) =>
    getAllTypes(db, type, fmap)
      .then(find(flow(get(propertyName), eq(propertyValue))))
      .then(defaultTo(null));

  const getAllUsers = partial(getAllTypes, redisClient, 'user');
  const findUserProfileByUserId = partial(findTypeByProperty, redisClient, 'userProfile', 'userId');

  return { user: { list: getAllUsers }, userProfile: { findByUserId: findUserProfileByUserId } };
}());
/* eslint-disable global-require */

const userProfilesPromise = DB.user.list()
  .then(map('id'))
  .then(map(DB.userProfile.findByUserId))
  .then(allP);

const tableConfig = {
  [TableTypeEnum.DeviceList]: [
    'status', 'name', 'firmwareVersion', 'model', 'uptime', 'lastSeen', 'cpu', 'signal', 'assignedTo',
  ],
  [TableTypeEnum.EndpointList]: [
    'status', 'name', 'address', 'site',
  ],
  [TableTypeEnum.SiteList]: [
    'status', 'name', 'address',
  ],
  [TableTypeEnum.FirmwareList]: [
    'origin', 'models', 'version', 'name', 'size', 'date',
  ],
  [TableTypeEnum.DiscoveryDeviceList]: [
    'status', 'name', 'model', 'ipAddress', 'macAddress', 'firmwareVersion', 'progress',
  ],
};


module.exports = {
  up() {
    return userProfilesPromise
      .then(map(assoc('tableConfig', tableConfig)))
      .then(map(DB.userProfile.update))
      .then(allP);
  },
  down() {
    return userProfilesPromise
      .then(map(dissoc('tableConfig')))
      .then(map(DB.userProfile.update))
      .then(allP);
  },
};
