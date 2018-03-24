'use strict';

const { getOr, map, now, flow, multiply } = require('lodash/fp');
const { when, equals, applySpec } = require('ramda');
const { stubNull } = require('ramda-adjunct');

const { parseDeviceVendor } = require('../../../../../../transformers/device/vendor/parser');

const parseHwStation = applySpec({
  timestamp: now,
  name: getOr(null, ['remote', 'hostname']),
  mac: getOr(null, ['mac']),
  vendor: flow(getOr('', ['mac']), parseDeviceVendor),
  radio: stubNull,
  ipAddress: flow(getOr(null, ['lastip']), when(equals('0.0.0.0'), stubNull)),
  upTime: getOr(null, ['uptime']),
  latency: getOr(null, ['tx_latency']),
  distance: flow(getOr(null, ['distance']), when(equals(100000), stubNull)),
  rxBytes: getOr(null, ['stats', 'rx_bytes']),
  txBytes: getOr(null, ['stats', 'tx_bytes']),
  rxRate: flow(getOr(0, ['rx']), multiply(1000000)),
  txRate: flow(getOr(0, ['tx']), multiply(1000000)),
  rxSignal: getOr(null, ['signal']),
  txSignal: getOr(null, ['remote', 'signal']),
  downlinkCapacity: stubNull,
  uplinkCapacity: stubNull,
  deviceIdentification: stubNull,
});

// parseHwStationList :: HwStations -> Array<CmStation>
//     HwStations = Object
//     CmStation = CorrespondenceModelStation = Object
const parseHwStationList = map(parseHwStation);

module.exports = {
  parseHwStationList,
};
