'use strict';

const { Observable } = require('rxjs/Rx');
const { tap } = require('lodash/fp');
const { when } = require('ramda');
const { isNotNull } = require('ramda-adjunct');
const { Reader: reader } = require('monet');

const { EntityEnum } = require('../../../enums');
const { entityExistsCheck, resolveP, rejectP, allP } = require('../../../util');
const { parseDbDeviceSiteId } = require('../../../transformers/device/parsers');
const {
  fromDb: fromDbDevice, fromDbList: fromDbDeviceList,
} = require('../../../transformers/device');
const { mergeMetadata, mergeStationListWithDeviceList } = require('../../../transformers/device/mergers');
const { merge: mergeM } = require('../../../transformers');
const { fromDb: fromDbDeviceMetadata } = require('../../../transformers/device/metadata');

/**
 * AirMax detail.
 */

const airMaxDetail = airMaxId => reader(
  ({ DB, deviceStore, firmwareDal, dal }) => {
    const dbAirMaxPromise = DB.airMax.findById(airMaxId)
      .then(tap(entityExistsCheck(EntityEnum.Device)));
    const dbSitePromise = dbAirMaxPromise
      .then(parseDbDeviceSiteId)
      .then(when(isNotNull, DB.site.findById));
    const dbDeviceMetadataPromise = dal.deviceMetadataRepository.findById(airMaxId);

    return allP([dbSitePromise, dbAirMaxPromise, dbDeviceMetadataPromise])
      .then(([dbSite, dbAirMax, dbDeviceMetadata]) =>
        fromDbDevice({ firmwareDal, deviceStore, dbSite }, dbAirMax)
          .chain(mergeM(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
          .cata(rejectP, resolveP));
  }
);

const airMaxStations = deviceId => reader(
  ({ deviceStore, DB }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.forkJoin(commDevice.getStations(), DB.device.list()))
    .mergeEither(([cmStationList, dbDeviceList]) =>
      mergeM(mergeStationListWithDeviceList, fromDbDeviceList({ deviceStore }, dbDeviceList), cmStationList)
    )
);

module.exports = {
  airMaxDetail,
  airMaxStations,
};

