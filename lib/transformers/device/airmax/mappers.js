'use strict';

const { map, pick } = require('ramda');

const { liftMapper } = require('../../index');
const { deviceModelToSeries } = require('../../../feature-detection/airmax');


// toApiAirmaxAttributes :: DeviceCorrespondence -> ApiAirmaxAttributes
//     DeviceCorrespondence = Object
//     ApiAirmaxAttributes = Object
const toApiAirmaxAttributes = correspondenceData => ({
  series: deviceModelToSeries(correspondenceData.identification.model),
  ssid: correspondenceData.airmax.ssid,
});


// toApiStationsList :: Array.<StationCorrespondence> -> Array.<StationApi>
//     StationCorrespondence = Object
//     StationApi = Object
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
  toApiAirmaxAttributes,
  toApiStationsList,

  safeToApiAirmaxAttributes: liftMapper(toApiAirmaxAttributes),
  safeToApiStationsList: liftMapper(toApiStationsList),
};
