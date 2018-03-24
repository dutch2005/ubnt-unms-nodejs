'use strict';

const redis = require('redis');
const bluebird = require('bluebird');
const { eq, curry, constant, invokeArgs, partial } = require('lodash/fp');
const { has, map, when, dissoc } = require('ramda');
const { renameKeys } = require('ramda-adjunct');

const { allP } = require('../../util');
const { DeviceTypeEnum } = require('../../enums');

const host = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
const port = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;
const tapP = curry((fn, val) => Promise.resolve(fn(val)).then(constant(val)));
const redisClient = redis.createClient({ host, port });
bluebird.promisifyAll(redis.RedisClient.prototype);


/* eslint-disable global-require */
const DB = (function iife() {
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

  const lift = (action, ...indexModifiers) => (obj) => {
    const actionPromise = action(obj);
    const modifiersPromise = actionPromise
      .then(constant(indexModifiers))
      .then(map(invokeArgs('call', [null, obj])))
      .then(promises => Promise.all(promises));

    return Promise.all([actionPromise, modifiersPromise]).then(actionPromise);
  };

  const addItemToSet = (db, setId, item) => db.saddAsync(setId, item);
  const addOnuToOltSet = onu => addItemToSet(redisClient, `oltSet${onu.onu.id}`, onu.id);
  const addOnuBackToOltSet = onu => addItemToSet(redisClient, `oltSet${onu.olt.id}`, onu.id);

  const insertOnu = partial(insertType, [redisClient, DeviceTypeEnum.Onu]);

  const getAllOnus = partial(getAllTypes, [redisClient, DeviceTypeEnum.Onu]);
  const insertOnuLifted = lift(insertOnu, addOnuToOltSet);
  const insertOnuBackLifted = lift(insertOnu, addOnuBackToOltSet);

  return {
    onu: {
      list: getAllOnus,
      update: insertOnuLifted,
      // specially for the sake of this migration
      updateBack: insertOnuBackLifted,
    },
  };
}());
/* eslint-disable global-require */


module.exports = {
  up() {
    return DB.onu.list()
      .then(map(when(
        has('olt'),
        renameKeys({ olt: 'onu' })
      )))
      .then(map(dissoc('olt')))
      .then(onuList => allP(map(DB.onu.update, onuList)));
  },
  down() {
    return DB.onu.list()
      .then(map(when(
        has('onu'),
        renameKeys({ onu: 'olt' })
      )))
      .then(map(dissoc('onu')))
      .then(onuList => allP(map(DB.onu.updateBack, onuList)));
  },
};
