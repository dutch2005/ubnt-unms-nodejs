'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { tap, get } = require('lodash/fp');
const { chain, when, map } = require('ramda');
const { cata } = require('ramda-adjunct');

const { entityExistsCheck, rejectP, resolveP, allP, isNotNull } = require('../../../util');
const { EntityEnum } = require('../../../enums');
const {
  fromDb: fromDbDevice, fromDbList: fromDbDeviceList, toApiOLTStatusDetail, toApiDeviceStatusOverviewList,
} = require('../../../transformers/device');
const { mergeMetadata } = require('../../../transformers/device/mergers');
const { merge } = require('../../../transformers');
const {
  fromApiOnuProfile, mergeOnuCount, toApiOnuProfileList, toApiOnuPolicies, fromApiOnuPolicies,
} = require('../../../transformers/device/olt');
const { fromDb: fromDbDeviceMetadata } = require('../../../transformers/device/metadata');

/**
 * Olt list.
 */

const oltList = () => reader(
  ({ DB, firmwareDal }) => oltList.loadData()
    .run({ DB, firmwareDal })
    .then(chain(toApiDeviceStatusOverviewList))
    .then(cata(rejectP, resolveP))
);

oltList.loadData = () => reader(
  ({ DB, firmwareDal }) => allP([DB.site.list(), DB.olt.list()])
    .then(([dbSiteList, dbOltList]) => fromDbDeviceList({ dbSiteList, firmwareDal }, dbOltList))
);

/**
 * Olt detail.
 */

const oltDetail = oltId => reader(
  ({ firmwareDal, DB, dal }) => {
    const dbOltPromise = DB.olt.findById(oltId)
      .then(tap(entityExistsCheck(EntityEnum.Olt)));
    const dbSitePromise = dbOltPromise
      .then(fromDbDevice({}))
      .then(map(get(['identification', 'siteId'])))
      .then(map(when(isNotNull, DB.site.findById)))
      .then(cata(rejectP, resolveP));
    const dbDeviceMetadataPromise = dal.deviceMetadataRepository.findById(oltId);

    return allP([dbOltPromise, dbSitePromise, dbDeviceMetadataPromise])
      .then(([dbOlt, dbSite, dbDeviceMetadata]) => fromDbDevice({ firmwareDal, dbSite }, dbOlt)
        .chain(merge(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
        .chain(toApiOLTStatusDetail)
        .cata(rejectP, resolveP));
  }
);

const resetOlt = oltId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => commOlt.resetInterfaceStats())
    .mapTo({ result: true, message: 'Olt statistics reset' })
    .toPromise()
);

/*
 * ONU Profiles.
 */

const onuProfileList = oltId => reader(
  ({ 'apiOnusV2.1': onus, deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => Observable.forkJoin(commOlt.getOnuProfiles(), onus.loadOnuList(oltId)))
    .mergeEither(([cmProfiles, cmOnuList]) => cmOnuList.chain(merge(mergeOnuCount, Either.of(cmProfiles))))
    .mergeEither(toApiOnuProfileList)
    .toPromise()
);

const createOnuProfile = (oltId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => Observable
      .fromEither(fromApiOnuProfile(payload))
      .mergeMap(cmOnuProfile => commOlt.createOnuProfile(cmOnuProfile))
      .mapTo(payload)
    )
    .toPromise()
);

const updateOnuProfile = (oltId, profileId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => Observable
      .fromEither(fromApiOnuProfile(payload))
      .mergeMap(cmOnuProfile => commOlt.updateOnuProfile(cmOnuProfile, profileId))
      .mapTo(payload)
    )
    .toPromise()
);

const deleteOnuProfile = (oltId, profileId) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => commOlt.deleteOnuProfile(profileId))
    .toPromise()
);

const getOnuPolicies = oltId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => commOlt.getOnuPolicies())
    .mergeEither(toApiOnuPolicies)
    .toPromise()
);

const setOnuPolicies = (oltId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => Observable
      .fromEither(fromApiOnuPolicies(payload))
      .mergeMap(cmOnuPolicies => commOlt.setOnuPolicies(cmOnuPolicies))
      .mapTo(payload)
    )
    .toPromise()
);

module.exports = {
  oltList,
  resetOlt,
  oltDetail,
  onuProfileList,
  createOnuProfile,
  updateOnuProfile,
  deleteOnuProfile,
  getOnuPolicies,
  setOnuPolicies,
};
