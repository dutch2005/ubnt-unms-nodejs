'use strict';

const { now } = require('lodash/fp');
const {
  pipe, pathOr, always, map, applySpec, concat, __, constructN, filter, trim, find, pathEq, split, view, lensIndex,
  converge, curry, merge, toUpper, compose, lensPath,
} = require('ramda');
const { isNotEmpty, stubNull } = require('ramda-adjunct');

const { FrequencyRangeEnum } = require('../../../../../enums');
const { viewOr } = require('../../../../../util');
const { parseDeviceVendor } = require('../../../../../transformers/device/vendor/parser');

const parseHwDHCPLeases = pipe(
  trim,
  split(/\n/g),
  filter(isNotEmpty),
  map(pipe(
    split(/\s+/g),
    applySpec({
      hostname: view(lensIndex(3)),
      macAddress: pipe(view(lensIndex(1)), toUpper),
      ipAddress: view(lensIndex(2)),
      expiration: pipe(
        view(lensIndex(0)),
        concat(__, '000'),
        Number,
        constructN(1, Date)
      ),
    })
  ))
);

const getStationDHCPData = curry((cmDhcpLeases, hwStation) => pipe(
  find(pathEq(['macAddress'], hwStation.mac)),
  applySpec({
    name: pathOr(null, ['hostname']),
    ipAddress: pathOr(null, ['ipAddress']),
  })
)(cmDhcpLeases));

const parseHwStation = curry(({ cmDhcpLeases }, radio, hwStation) => converge(merge, [
  getStationDHCPData(cmDhcpLeases),
  applySpec({
    timestamp: now,
    vendor: pipe(pathOr('', ['mac']), parseDeviceVendor),
    radio: always(radio),
    mac: pathOr(null, ['mac']),
    upTime: stubNull,
    latency: stubNull,
    distance: stubNull,
    rxBytes: pathOr(null, ['rx', 'bytes']),
    txBytes: pathOr(null, ['tx', 'bytes']),
    rxRate: always(0),
    txRate: always(0),
    rxSignal: pathOr(null, ['signal']),
    txSignal: stubNull,
    downlinkCapacity: stubNull,
    uplinkCapacity: stubNull,
    deviceIdentification: stubNull,
  }),
])(hwStation));

const parseHwStationsList = (auxiliaries, { hw2GHzStations, hw5GHzStations, hwDhcpLeases }) => {
  const cmDhcpLeases = parseHwDHCPLeases(pathOr('', ['data'], hwDhcpLeases));

  return converge(concat, [
    pipe(
      viewOr([], compose(lensIndex(0), lensPath(['results']))),
      map(parseHwStation({ cmDhcpLeases }, FrequencyRangeEnum.Wifi2GHz))
    ),
    pipe(
      viewOr([], compose(lensIndex(1), lensPath(['results']))),
      map(parseHwStation({ cmDhcpLeases }, FrequencyRangeEnum.Wifi5GHz))
    ),
  ])([hw2GHzStations, hw5GHzStations]);
};

module.exports = {
  parseHwStationsList,
};
