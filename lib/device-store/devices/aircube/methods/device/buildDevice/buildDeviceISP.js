'use strict';

const { partial } = require('lodash/fp');

const { ubusRequest } = require('../../../../../backends/openwrt/messages');
const {
  parseHwSystemBoard, parseHwSystemInfo, parseHwIpGateway, parseHwMode, parseHwWlanInterface, parseHwWanPoe,
  parseHwWifiMode,
} = require('../../../transformers/device/parsers');
const { mergeDeviceUpdate } = require('../../../../../../transformers/device/mergers');

const systemConfigRequest = partial(ubusRequest, [[
  {
    id: 'hwSystemBoard',
    path: 'system',
    method: 'board',
    args: {},
  },
  {
    id: 'hwSystemInfo',
    path: 'system',
    method: 'info',
    args: {},
  },
  {
    id: 'hwConfigHwctl',
    path: 'uci',
    method: 'get',
    args: { config: 'ubnt', section: 'hwctl' },
  },
  {
    id: 'hwLanInterface', // IP address
    path: 'network.interface.lan',
    method: 'status',
    args: {},
  },
  {
    id: 'hwRadio2GhzInfo',
    path: 'iwinfo',
    method: 'info',
    args: { device: 'wlan0' },
  },
  {
    id: 'hwWanInterface', // IP address
    path: 'network.interface.wan',
    method: 'status',
    args: {},
  },
]]);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} cmDeviceStub
 * @return {Observable.<CorrespondenceDevice>}
 */
function buildDevice(cmDeviceStub) {
  return this.connection.rpc(systemConfigRequest())
    .map((hwSystem) => {
      const {
        hwSystemBoard, hwSystemInfo, hwLanInterface, hwWanInterface, hwRadio2GhzInfo, hwConfigHwctl,
      } = hwSystem.data;
      return mergeDeviceUpdate(
        cmDeviceStub,
        parseHwSystemBoard({}, hwSystemBoard),
        parseHwSystemInfo({}, hwSystemInfo),
        parseHwIpGateway({ hwLanInterface, hwWanInterface }),
        parseHwMode(hwWanInterface),
        parseHwWlanInterface('wifi2Ghz', hwRadio2GhzInfo),
        parseHwWifiMode(),
        parseHwWanPoe(hwConfigHwctl)
      );
    });
}

module.exports = buildDevice;
