'use strict';

const { flow, values, sortBy, map, size, groupBy, reduce, mapValues } = require('lodash/fp');

const { DB } = require('../../db');
const { resolveP } = require('../../util');
const { mergeDeviceStats, mergeInterfaceStats } = require('../../statistics/strategies');

const redisClient = DB.redis;

const mergeStats = (accumulator, statistics) => {
  if (accumulator === null) { return statistics }

  if (statistics.stats) {
    // eslint-disable-next-line no-param-reassign
    accumulator = mergeDeviceStats(accumulator, statistics);
  }

  return mergeInterfaceStats(accumulator, statistics);
};

const fixStatistics = flow(
  mapValues(reduce(mergeStats, null)),
  values,
  sortBy('timestamp')
);

module.exports = {
  up() {
    return redisClient.keysAsync('statistics-*')
      .then(statisticsKeys => statisticsKeys
        .reduce((accumulator, key) => accumulator.then(() => redisClient.lrangeAsync(key, 0, -1)
            .then(map(JSON.parse))
            .then((statistics) => {
              const grouped = groupBy('timestamp', statistics);
              if (statistics.length !== size(grouped)) {
                const fixedStats = fixStatistics(grouped);
                const batch = redisClient.batch();
                batch.del(key);
                batch.lpush(key, fixedStats.map(JSON.stringify));
                return batch.execAsync();
              }

              return null;
            })),
          resolveP()
        ));
  },
  down() {
    // cannot revert
  },
};
