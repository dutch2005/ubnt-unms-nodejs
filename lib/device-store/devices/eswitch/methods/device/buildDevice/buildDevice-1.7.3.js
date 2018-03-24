'use strict';

const { Observable } = require('rxjs/Rx');

const { deviceIpRequest } = require('../../../messages');
const { sysInfoRequest } = require('../../../../../backends/ubridge/messages');
const { parseHwSysInfo, parseHwDeviceIp } = require('../../../transformers/device/parsers');
const { mergeDeviceUpdate } = require('../../../../../../transformers/device/mergers');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} [cmDeviceStub]
 * @return {Observable.<CorrespondenceDevice>}
 */
function buildDevice(cmDeviceStub = {}) {
  return Observable.forkJoin(this.connection.rpc(deviceIpRequest()), this.connection.rpc(sysInfoRequest()))
    .map(([hwDeviceIp, hwSysInfo]) => mergeDeviceUpdate(
      cmDeviceStub,
      parseHwDeviceIp({}, hwDeviceIp),
      parseHwSysInfo({}, hwSysInfo)
    ));
}

module.exports = buildDevice;
