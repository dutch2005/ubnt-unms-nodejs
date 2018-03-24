'use strict';

const { first, get, defaultTo, isNull } = require('lodash/fp');

/* eslint-disable global-require,no-shadow */
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

const addUserIdColumn = defaultUserId => (isNull(defaultUserId)
  ? `
  ALTER TABLE task ADD COLUMN user_id uuid NOT NULL;
  `
  : `
  ALTER TABLE task ADD COLUMN user_id uuid;
  UPDATE task SET user_id = '${defaultUserId}';
  ALTER TABLE task ALTER COLUMN user_id SET NOT NULL;
 `);

const upQueries = [
  `
  ALTER TYPE logTypeEnum RENAME TO logTypeEnum__;
  `,
  `
  CREATE TYPE logTypeEnum AS ENUM (
    'other',
    'device-appear',
    'device-disappear',
    'device-reappear',
    'device-outage',
    'device-upgrade-start',
    'device-upgrade-success',
    'device-upgrade-failed',
    'device-upgrade-cancel',
    'device-ram-over-limit',
    'device-cpu-over-limit',
    'device-authorize',
    'device-move',
    'device-backup-create',
    'device-backup-apply',
    'device-restart',
    'device-delete',
    'device-automatic-backup-create',
    'user-login',
    'user-login-fail', 
    'event-notification-fail'
  );
  `,
  `
  ALTER TABLE log ALTER COLUMN type SET DEFAULT NULL;
  `,
  `
  ALTER TABLE log 
    ALTER COLUMN type TYPE logTypeEnum 
    USING type::text::logTypeEnum;
  `,
  `
  ALTER TABLE log ALTER COLUMN type SET DEFAULT 'other';
  `,
  `
  DROP TYPE logTypeEnum__;
  `,
];

const downQueries = [
  `
  ALTER TABLE task DROP COLUMN IF EXISTS user_id;
  `,
  `
  ALTER TYPE logTypeEnum RENAME TO logTypeEnum__;
  `,
  `
  CREATE TYPE logTypeEnum AS ENUM (
    'other',
    'device-appear',
    'device-disappear',
    'device-reappear',
    'device-outage',
    'device-ram-over-limit',
    'device-cpu-over-limit',
    'device-authorize',
    'device-move',
    'device-backup-create',
    'device-backup-apply',
    'device-restart',
    'device-delete',
    'device-automatic-backup-create',
    'user-login',
    'user-login-fail', 
    'event-notification-fail'
  );
  `,
  `
  ALTER TABLE log ALTER COLUMN type SET DEFAULT NULL;
  `,
  `
  ALTER TABLE log 
    ALTER COLUMN type TYPE logTypeEnum 
    USING type::text::logTypeEnum;
  `,
  `
  ALTER TABLE log ALTER COLUMN type SET DEFAULT 'other';
  `,
  `
  DROP TYPE logTypeEnum__;
  `,
];

module.exports = {
  up(queryInterface) {
    return DB.user.list()
      .then(first)
      .then(get('id'))
      .then(userId => queryInterface.sequelize.query(addUserIdColumn(defaultTo(null, userId))))
      .then(() => upQueries
        .reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve())
      );
  },
  down(queryInterface) {
    return downQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve());
  },
};
