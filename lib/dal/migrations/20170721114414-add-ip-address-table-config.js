'use strict';

const { path, concat, assocPath, reject, equals } = require('ramda');
const { isNotNil } = require('ramda-adjunct');

const { DB } = require('../../db');
const { resolveP } = require('../../util');

const redisClient = DB.redis;

module.exports = {
  up() {
    return redisClient.keysAsync('userProfile:*')
      .then(userProfileKeys => userProfileKeys
        .reduce((accumulator, key) => accumulator.then(() => {
          redisClient.getAsync(key)
            .then((value) => {
              const parseValue = JSON.parse(value);
              if (isNotNil(parseValue.tableConfig)) {
                const deviceList = path(['tableConfig', 'deviceList'], parseValue);
                const newKeyValue =
                  assocPath(['tableConfig', 'deviceList'], concat(['ipAddress'], deviceList), parseValue);
                const batch = redisClient.batch();
                batch.del(key);
                batch.set(key, JSON.stringify(newKeyValue));
                return batch.execAsync();
              }
              return null;
            });
        }),
          resolveP()
        ));
  },
  down() {
    return redisClient.keysAsync('userProfile:*')
      .then(userProfileKeys => userProfileKeys
        .reduce((accumulator, key) => accumulator.then(() => {
          redisClient.getAsync(key)
            .then((value) => {
              const parseValue = JSON.parse(value);
              if (isNotNil(parseValue.tableConfig)) {
                const deviceList = path(['tableConfig', 'deviceList'], parseValue);
                const newKeyValue =
                  assocPath(['tableConfig', 'deviceList'], reject(equals('ipAddress'), deviceList), parseValue);
                const batch = redisClient.batch();
                batch.del(key);
                batch.set(key, JSON.stringify(newKeyValue));
                return batch.execAsync();
              }
              return null;
            });
        }),
          resolveP()
        ));
  },
};
