'use strict';

const { isNil, keys, getOr } = require('lodash/fp');
const { assocPath } = require('ramda');

const { weightedAverage } = require('../util');


// strategy for merging device statistics
// mergeDeviceStats :: (Object, Object) -> Object
function mergeDeviceStats(cmOldStats, cmNewStats) {
  if (isNil(cmOldStats)) return cmNewStats;

  const result = Object.assign({}, cmOldStats, { weight: (cmOldStats.weight || 0) + cmNewStats.weight, stats: {} });

  Object
    .keys(cmNewStats.stats)
    .forEach((name) => {
      result.stats[name] = cmOldStats.stats && Object.hasOwnProperty.call(cmOldStats.stats, name)
        ? weightedAverage(cmOldStats.stats[name], cmOldStats.weight, cmNewStats.stats[name], cmNewStats.weight)
        : cmNewStats.stats[name];
    });

  return result;
}

// strategy for merging device interfaces statistics
// mergeInterfaceStats :: (Object, Object) -> Object
function mergeInterfaceStats(cmOldStats, cmNewStats) {
  const newInterfaceNames = keys(cmNewStats.interfaces);
  const existingInterfaceStats = cmOldStats.interfaces;
  const mergedInterfaces = newInterfaceNames.reduce((accumulator, interfaceName) => {
    const existingStats = getOr(null, ['interfaces', interfaceName], cmOldStats);
    const newStats = cmNewStats.interfaces[interfaceName];
    return assocPath([interfaceName], mergeDeviceStats(existingStats, newStats), accumulator);
  }, existingInterfaceStats);
  return assocPath(['interfaces'], mergedInterfaces, cmOldStats);
}

function mergeStats(cmOldStats, cmNewStats) {
  return mergeDeviceStats(mergeInterfaceStats(cmOldStats, cmNewStats), cmNewStats);
}


module.exports = {
  mergeDeviceStats,
  mergeInterfaceStats,
  mergeStats,
};
