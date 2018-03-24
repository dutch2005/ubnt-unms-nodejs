'use strict';

const { omit, map } = require('lodash/fp');
const { reduceP } = require('ramda-adjunct');

/* eslint-disable global-require */
const DB = (function iife() {
  const redis = require('redis');
  const bluebird = require('bluebird');
  const { partial } = require('lodash');
  const { eq, curry, constant } = require('lodash/fp');
  const host = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
  const port = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;

  const tapP = curry((fn, val) => Promise.resolve(fn(val)).then(constant(val)));

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

  const getAllErouters = partial(getAllTypes, redisClient, 'erouter');
  const insertErouter = partial(insertType, redisClient, 'erouter');
  const getAllOlts = partial(getAllTypes, redisClient, 'olt');
  const insertOlt = partial(insertType, redisClient, 'olt');

  return {
    erouter: { list: getAllErouters, update: insertErouter },
    olt: { list: getAllOlts, update: insertOlt },
  };
}());
/* eslint-disable global-require */

module.exports = {
  up() {
    return DB.erouter.list()
      .then(map(omit(['ipAddress', 'gateway'])))
      .then(reduceP((acc, device) => DB.erouter.update(device), null))
      .then(() => DB.olt.list())
      .then(map(omit(['ipAddress', 'gateway'])))
      .then(reduceP((acc, device) => DB.olt.update(device), null))
      ;
  },

  down() {
    // not needed - do nothing.
  },
};
