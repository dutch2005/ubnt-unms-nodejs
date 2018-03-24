'use strict';

const { Reader: reader } = require('monet');
const { pathOr, pathEq, pipeP } = require('ramda');
const { find, tap } = require('lodash/fp');

const { EntityEnum } = require('../../../enums');
const { entityExistsCheck, resolveP } = require('../../../util');


/**
 * AirMax detail.
 */

const airMaxDetail = deviceId => reader(
  ({ fixtures }) => pipeP(
    resolveP,
    find(pathEq(['identification', 'id'], deviceId)),
    tap(entityExistsCheck(EntityEnum.Device))
  )(fixtures.devices.fixtures)
);

const airMaxStations = deviceId => reader(
  ({ fixtures }) => pipeP(
    resolveP,
    fixtures.devices.getDeviceWithStations,
    pathOr(null, ['airmax', 'stations'])
  )(deviceId)
);


module.exports = {
  airMaxDetail,
  airMaxStations,
};

