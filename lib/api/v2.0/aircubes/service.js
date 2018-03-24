'use strict';

const { Reader: reader } = require('monet');
const { pathOr, pipeP } = require('ramda');
const { EntityEnum } = require('../../../enums');
const { entityExistsCheck, resolveP } = require('../../../util');
const { tap } = require('lodash/fp');


/**
 * AirCube detail.
 */

const airCubeDetail = deviceId => reader(
  ({ fixtures }) => pipeP(
    resolveP,
    fixtures.devices.getDeviceWithStations,
    tap(entityExistsCheck(EntityEnum.Device))
  )(deviceId)
);

const airCubeStations = deviceId => reader(
  ({ fixtures }) => pipeP(
    resolveP,
    fixtures.devices.getDeviceWithStations,
    pathOr(null, ['aircube', 'stations'])
  )(deviceId)
);


module.exports = {
  airCubeDetail,
  airCubeStations,
};

