'use strict';

const { Observable } = require('rxjs/Rx');

const { deviceConfigRequest, deviceStatusRequest } = require('../../../../../backends/airos/messages');
const { deviceModelToSeries } = require('../../../../../../feature-detection/airmax');
const { parseHwStatus } = require('../../../transformers/device/AC/parsers');
const { parseHwModel, parseHwDeviceConfig } = require('../../../transformers/device/parsers');
const { mergeDeviceUpdate } = require('../../../../../../transformers/device/mergers');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} cmDeviceStub
 * @return {Observable.<CorrespondenceDevice>}
 */
function buildACDevice(cmDeviceStub) {
  const deviceConfig$ = this.connection.cmd(deviceConfigRequest());
  const deviceStatus$ = this.connection.rpc(deviceStatusRequest());

  return Observable.forkJoin(deviceConfig$, deviceStatus$)
    .map(([hwDeviceConfig, hwStatus]) => {
      const cmAirMax = mergeDeviceUpdate(
        cmDeviceStub,
        parseHwStatus({}, hwStatus),
        parseHwDeviceConfig({}, hwDeviceConfig)
      );

      // handle AirMax model inconsistencies
      const model = parseHwModel({ hwStatus }, hwDeviceConfig.data);
      cmAirMax.identification.model = model;
      cmAirMax.airmax.series = deviceModelToSeries(model);

      return cmAirMax;
    });
}

module.exports = buildACDevice;
