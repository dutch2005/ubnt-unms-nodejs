'use strict';

const { assocPath, map } = require('ramda');
const { isNull, flow } = require('lodash/fp');


// resetInterfaceStatistics :: (InterfaceCorrespondenceData a, InterfaceCorrespondenceData b) => a -> b
const resetInterfaceStatistics = (cmInterface) => {
  if (isNull(cmInterface.statistics)) { return null }

  return flow(
    assocPath(['statistics', 'previousTxbytes'], cmInterface.statistics.txbytes),
    assocPath(['statistics', 'previousRxbytes'], cmInterface.statistics.rxbytes),
    assocPath(['statistics', 'previousDropped'], cmInterface.statistics.dropped),
    assocPath(['statistics', 'previousErrors'], cmInterface.statistics.errors)
)(cmInterface);
};

// resetInterfaceListStatistics :: Array.<InterfaceCorrespondenceData>
const resetInterfaceListStatistics = map(resetInterfaceStatistics);


module.exports = {
  resetInterfaceStatistics,
  resetInterfaceListStatistics,
};
