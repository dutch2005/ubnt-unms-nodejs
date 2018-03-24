'use strict';

const { Observable } = require('rxjs/Rx');

const {
  deviceConfigRequest, deviceStatusRequest, stationListRequest,
} = require('../../../../../backends/airos/messages');
const { deviceModelToSeries } = require('../../../../../../feature-detection/airmax');
const { parseHwStatus } = require('../../../transformers/device/M/parsers');
const { parseHwModel, parseHwDeviceConfig } = require('../../../transformers/device/parsers');
const { mergeDeviceUpdate } = require('../../../../../../transformers/device/mergers');

function buildMDevice(cmDeviceStub) {
  const deviceConfig$ = this.connection.cmd(deviceConfigRequest());
  const deviceStatus$ = this.connection.rpc(deviceStatusRequest());
  const stationList$ = this.connection.rpc(stationListRequest()).pluck('data');

  return Observable.forkJoin(deviceConfig$, deviceStatus$, stationList$)
    .map(([hwDeviceConfig, hwStatus, hwStationList]) => {
      const cmAirMax = mergeDeviceUpdate(
        cmDeviceStub,
        parseHwStatus({}, { hwStatus, hwStationList }),
        parseHwDeviceConfig({}, hwDeviceConfig)
      );

      // handle AirMax model inconsistencies
      const model = parseHwModel({ hwStatus }, hwDeviceConfig.data);
      cmAirMax.identification.model = model;
      cmAirMax.airmax.series = deviceModelToSeries(model);

      return cmAirMax;
    });
}

module.exports = buildMDevice;
