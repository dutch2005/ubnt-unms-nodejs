'use strict';

const { isNil } = require('lodash/fp');
const { Reader: reader } = require('monet');

const { roundToMultiple } = require('../util');
const { mergeStats, mergeDeviceStats, mergeInterfaceStats } = require('./strategies');


/**
 * Helper function for `createStatisticsUpdateBatch`.
 *
 * @param {!Object} cmExistingStats
 * @param {!Object} cmNewStats
 * @param {number} period
 * @param {Function} mergeFunction
 * @return {!Object}
 */
function mergeStatisticsIfSamePeriod(cmExistingStats, cmNewStats, period, mergeFunction) {
  if (isNil(cmExistingStats)) return [cmNewStats];
  const stats1 = Object.assign({}, cmExistingStats, { timestamp: roundToMultiple(cmExistingStats.timestamp, period) });
  const stats2 = Object.assign({}, cmNewStats, { timestamp: roundToMultiple(cmNewStats.timestamp, period) });
  if (stats1.timestamp !== stats2.timestamp) return [stats1, stats2];
  return [mergeFunction(stats1, stats2)];
}

/**
 * Contains main business logic.
 *
 * @param {Function} mergeFunc
 * @param {number} deviceId
 * @param {!Object} cmNewStats
 * @return {Promise.<{toAdd: Array, toTrim: Array}>}
 */
const createStatisticsUpdateBatch = (mergeFunc, deviceId, cmNewStats) => reader(
  ({ DB, config }) => {
    const toAdd = [];
    const toTrim = [];

    // get last existing statistics from DB, merge with new statistics
    // if in the same period, (re)insert separately if not
    // TODO(jaroslav.klima@ubnt.com): optimization possible
    // statistics to be updated can all be read in a single batch and inserted in another single batch
    // longer interval statistics don't need to be updated on every "tick"
    const actions = Object.keys(config.statisticsIntervals).map((intervalName) => {
      const interval = config.statisticsIntervals[intervalName];
      return DB.statistics.getLastItem(intervalName, deviceId)
        .then((existingStats) => {
          const mergedStats = mergeStatisticsIfSamePeriod(existingStats, cmNewStats, interval.period, mergeFunc);
          toAdd.push({ intervalName, deviceId, stats: mergedStats });
          // delete old statistics - keep no more than length/period statistics in each interval
          // TODO(jaroslav.klima@ubnt.com): optimization possible
          // statistics can be truncated in a separate periodic process for all types and IDs in a single batch
          toTrim.push({ intervalName, deviceId, count: (interval.length / interval.period) });
        });
    });

    return Promise.all(actions).then(() => ({ toAdd, toTrim }));
  }
);

const collect = (deviceId, cmStats) => reader(
  ({ DB, config }) => createStatisticsUpdateBatch(mergeStats, deviceId, cmStats)
    .run({ DB, config })
    .then(DB.statistics.update)
);

// collects statistics for particular device into UMNS
// collectForDevice :: Number -> Object  -> Promise.<Boolean>
const collectForDevice = (deviceId, cmStats) => reader(
  ({ DB, config }) => createStatisticsUpdateBatch(mergeDeviceStats, deviceId, cmStats)
    .run({ DB, config })
    .then(DB.statistics.update)
);

// collects statistics for particular device's interfaces into UMNS
// collectForInterfaces :: Number -> Object -> Promise.<Boolean>
const collectForInterfaces = (deviceId, cmStats) => reader(
  ({ DB, config }) => createStatisticsUpdateBatch(mergeInterfaceStats, deviceId, cmStats)
    .run({ DB, config })
    .then(DB.statistics.update)
);

// delete all statistics of a particular device
const deleteDeviceStatistics = deviceId => reader(
  ({ DB, config }) => Promise.all(
    Object.keys(config.statisticsIntervals)
      .map(intervalName => DB.statistics.delete(intervalName, deviceId))
  )
);

module.exports = {
  collect,
  collectForDevice,
  collectForInterfaces,
  deleteDeviceStatistics,
};
