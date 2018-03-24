'use strict';

const { stationListRequest } = require('../../../../../backends/airos/messages');
const { parseHwStationList } = require('../../../transformers/stations/M/parsers');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<void>}
 */
function getStations() {
  return this.connection.rpc(stationListRequest())
    .pluck('data')
    .map(parseHwStationList);
}

module.exports = getStations;
