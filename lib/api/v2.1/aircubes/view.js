'use strict';

const { Reader: reader } = require('monet');
const { cata } = require('ramda-adjunct');

const { resolveP, rejectP } = require('../../../util');
const { toApiAirCubeStatusDetail } = require('../../../transformers/device');
const { toApiStationsList } = require('../../../transformers/device/aircube');

const deviceDetail = (request, reply) => reader(
  ({ service }) => {
    const { id: deviceId } = request.params;

    reply(
      service
        .airCubeDetail(deviceId)
        .then(toApiAirCubeStatusDetail)
        .then(cata(rejectP, resolveP))
    );
  }
);

const stations = (request, reply) => reader(
  ({ service }) => {
    const { id: deviceId } = request.params;

    reply(
      service.listStations(deviceId)
        .mergeEither(toApiStationsList)
        .toPromise()
    );
  }
);

module.exports = {
  deviceDetail,
  stations,
};
