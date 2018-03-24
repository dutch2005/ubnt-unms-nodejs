'use strict';

const { Observable } = require('rxjs/Rx');
const { tap } = require('lodash/fp');
const { when, assocPath, always } = require('ramda');
const { isNotNull } = require('ramda-adjunct');
const { Reader: reader } = require('monet');

const { EntityEnum } = require('../../../enums');
const { entityExistsCheck, resolveP, rejectP, allP } = require('../../../util');
const { parseDbDeviceSiteId } = require('../../../transformers/device/parsers');
const { fromDb: fromDbDevice } = require('../../../transformers/device');
const { mergeMetadata } = require('../../../transformers/device/mergers');
const { merge } = require('../../../transformers');
const { fromDb: fromDbDeviceMetadata } = require('../../../transformers/device/metadata');


/**
 * AirCube detail.
 */

const airCubeDetail = deviceId => reader(
  ({ DB, deviceStore, firmwareDal, dal }) => {
    const dbAirCubePromise = DB.airCube.findById(deviceId)
      .then(tap(entityExistsCheck(EntityEnum.Device)));
    const dbSitePromise = dbAirCubePromise
      .then(parseDbDeviceSiteId)
      .then(when(isNotNull, DB.site.findById));
    const dbDeviceMetadataPromise = dal.deviceMetadataRepository.findById(deviceId);

    const stationsPromise = resolveP(deviceStore.get(deviceId))
      .then(tap(entityExistsCheck(EntityEnum.Device)))
      .then(commDevice => commDevice.getStations().toPromise())
      .catch(always([]));

    return allP([dbSitePromise, dbAirCubePromise, dbDeviceMetadataPromise, stationsPromise])
      .then(([dbSite, dbAirCube, dbDeviceMetadata, stations]) =>
        fromDbDevice({ firmwareDal, deviceStore, dbSite }, dbAirCube)
          .chain(merge(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
          .map(assocPath(['aircube', 'stations'], stations))
          .cata(rejectP, resolveP));
  }
);

const listStations = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getStations())
);


module.exports = {
  airCubeDetail,
  listStations,
};

