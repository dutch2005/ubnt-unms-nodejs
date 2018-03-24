'use strict';

const { pick, map, join, pathOr, complement, pipe, converge, unapply, filter, when } = require('ramda');
const { isNilOrEmpty, stubNull } = require('ramda-adjunct');
const { liftMapper } = require('../../index');

const toApiAircubeAttributes = correspondenceData => ({
  ssid: pipe(
    converge(unapply(filter(complement(isNilOrEmpty))), [
      pathOr(null, ['aircube', 'wifi5Ghz', 'ssid']),
      pathOr(null, ['aircube', 'wifi2Ghz', 'ssid']),
    ]),
    join('/'),
    when(isNilOrEmpty, stubNull)
  )(correspondenceData),
});

const toApiStationsList = cmStationsList => map(pick([
  'timestamp',
  'ipAddress',
  'name',
  'vendor',
  'radio',
  'mac',
  'upTime',
  'latency',
  'distance',
  'rxBytes',
  'txBytes',
  'rxRate',
  'txRate',
  'rxSignal',
  'txSignal',
  'downlinkCapacity',
  'uplinkCapacity',
  'deviceIdentification',
]))(cmStationsList);

module.exports = {
  toApiAircubeAttributes,
  toApiStationsList,

  safeToAircubeAttributes: liftMapper(toApiAircubeAttributes),
  safeToApiStationsList: liftMapper(toApiStationsList),
};
