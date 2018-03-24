'use strict';

const { deviceConfigRequest } = require('../../../messages');
const { parseHwConfig } = require('../../../transformers/device/parsers');
const { mergeDeviceUpdate } = require('../../../../../../transformers/device/mergers');

// TODO(michal.sedlak@ubnt.com): REMOVE some time after ES 1.7.3 final release

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} cmDeviceStub
 * @return {Observable.<CorrespondenceDevice>}
 */
function buildDevice(cmDeviceStub) {
  return this.connection.rpc(deviceConfigRequest())
    .map(hwConfig => mergeDeviceUpdate(cmDeviceStub, parseHwConfig({}, hwConfig)));
}

module.exports = buildDevice;
