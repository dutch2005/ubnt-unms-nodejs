'use strict';

const { Reader: reader } = require('monet');
const { cata } = require('ramda-adjunct');

const { resolveP, rejectP } = require('../../../util');
const { toApiAirMaxStatusDetail } = require('../../../transformers/device');
const { toApiStationsList } = require('../../../transformers/device/airmax/mappers');

const deviceDetail = (request, reply) => reader(
  ({ service }) => {
    const { id: deviceId } = request.params;

    reply(
      service
        .airMaxDetail(deviceId)
        .then(toApiAirMaxStatusDetail)
        .then(cata(rejectP, resolveP))
    );
  }
);

const stations = (request, reply) => reader(
  ({ service }) => {
    const { id: deviceId } = request.params;

    reply(
      service.airMaxStations(deviceId)
        .map(toApiStationsList)
        .toPromise()
    );
  }
);


module.exports = {
  deviceDetail,
  stations,
};
