'use strict';

const { keyBy, get, reject, last, has } = require('lodash/fp');

const { DB } = require('../../db');

const redisClient = DB.redis;

module.exports = {
  up() {
    return DB.device.findAll()
      .then(keyBy(get(['identification', 'id'])))
      .then(deviceMap => redisClient.keysAsync('statistics-*')
        .then(reject(key => has(last(key.split(':')), deviceMap)))
        .then((keysToDelete) => {
          if (keysToDelete.length === 0) { return null }

          return redisClient.delAsync(keysToDelete);
        })
      );
  },
  down() {
    // cannot revert cleanup
  },
};
