'use strict';

const { partial } = require('lodash/fp');

const { ubusRequest } = require('../../../../../backends/openwrt/messages');
const parsers = require('../../../transformers/stations/parsers');

const stationsRequest = partial(ubusRequest, [[
  {
    id: 'hw2GHzStations',
    path: 'iwinfo',
    method: 'assoclist',
    args: { device: 'wlan0' },
  },
  {
    id: 'hw5GHzStations',
    path: 'iwinfo',
    method: 'assoclist',
    args: { device: 'wlan1' },
  },
  {
    id: 'hwDhcpLeases',
    path: 'file',
    method: 'read',
    args: { path: '/tmp/dhcp.leases' },
  },
]]);

const parseHwStationsList = partial(parsers.parseHwStationsList, [{}]);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<void>}
 */
function getStations() {
  return this.connection.rpc(stationsRequest())
    .map(({ data }) => parseHwStationsList(data));
}

module.exports = getStations;
