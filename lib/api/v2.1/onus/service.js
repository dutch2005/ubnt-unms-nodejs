'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { when, chain, map } = require('ramda');
const { cata } = require('ramda-adjunct');
const { constant, tap, get, identity } = require('lodash/fp');

const { EntityEnum, LogTypeEnum } = require('../../../enums');
const { entityExistsCheck, tapP, resolveP, rejectP, thenP, allP, isNotNull } = require('../../../util');
const {
  fromDb: fromDbDevice, fromDbList: fromDbDeviceList, toDb: toDbDevice,
  toApiONUStatusOverview, toApiONUStatusOverviewList, fromApiOnuPatchRequest,
} = require('../../../transformers/device');
const { merge } = require('../../../transformers');
const {
  mergeOnusWithOnuProfiles, mergeOnuUpdateRequestUpdateWithOnuDevice, mergeInterfaces,
} = require('../../../transformers/device/mergers');
const { fromDbList: fromDbInterfaceList, toDbInterfaceList } = require('../../../transformers/interfaces');
const { resetInterfaceListStatistics: resetInterfaceListStatisticsAp } = require('../../../transformers/interfaces/ap');

const onuList = oltId => reader(
  ({ DB, deviceStore, firmwareDal }) => Observable.of(deviceStore.get(oltId))
    .do(entityExistsCheck(EntityEnum.Olt))
    .mergeMap(commOlt => Observable.forkJoin(
      commOlt.getOnuProfiles(),
      onuList.loadData(oltId).run({ DB, deviceStore, firmwareDal }))
    )
    .mergeEither(([cmProfiles, cmOnuList]) => cmOnuList.chain(merge(mergeOnusWithOnuProfiles, Either.of(cmProfiles))))
    .mergeEither(toApiONUStatusOverviewList)
    .toPromise()
);

onuList.loadData = parentId => reader(
  ({ DB, deviceStore, firmwareDal }) => {
    const dbOnuListPromise = DB.onu.findAll({ oltId: parentId });

    return allP([DB.site.list(), dbOnuListPromise])
      .then(([dbSiteList, dbOnuList]) => fromDbDeviceList({ dbSiteList, firmwareDal, deviceStore }, dbOnuList));
  }
);

const onuDetail = onuId => reader(
  ({ DB, deviceStore, firmwareDal }) => onuDetail.loadData(onuId)
    .run(({ DB, deviceStore, firmwareDal }))
    .then(chain(toApiONUStatusOverview))
    .then(cata(rejectP, resolveP))
);

onuDetail.loadData = onuId => reader(
  ({ DB, deviceStore, firmwareDal }) => {
    const dbOnuPromise = DB.onu.findById(onuId)
      .then(tap(entityExistsCheck(EntityEnum.Onu)));
    const dbSitePromise = dbOnuPromise
      .then(fromDbDevice({}))
      .then(map(get(['identification', 'siteId'])))
      .then(map(when(isNotNull, DB.site.findById)))
      .then(cata(rejectP, resolveP));

    return allP([dbSitePromise, dbOnuPromise])
      .then(([dbSite, dbOnu]) => fromDbDevice({ firmwareDal, deviceStore, dbSite }, dbOnu));
  }
);

const updateOnu = (onuId, payload) => reader(
  ({ DB, deviceStore, firmwareDal }) => Observable
    .from(onuDetail.loadData(onuId).run(({ DB, deviceStore, firmwareDal })))
    .mergeEither(identity)
    .mergeEither(merge(mergeOnuUpdateRequestUpdateWithOnuDevice, fromApiOnuPatchRequest(payload)))
    .mergeMap(cmOnu => Observable.of(deviceStore.get(cmOnu.onu.id))
      .do(entityExistsCheck(EntityEnum.Olt))
      .mergeMap(commOlt => commOlt.updateOnu(cmOnu))
      .mapTo(cmOnu)
    )
    .mergeEither(toApiONUStatusOverview)
    .toPromise()
);

const restartOnu = onuId => reader(
  ({ DB, deviceStore }) => Observable.from(DB.onu.findById(onuId))
    .do(entityExistsCheck(EntityEnum.Onu))
    .mergeEither(fromDbDevice({}))
    .mergeMap(cmOnu => Observable.of(deviceStore.get(cmOnu.onu.id))
      .do(entityExistsCheck(EntityEnum.Olt))
      .mergeMap(commOlt => commOlt.restartOnu(cmOnu.onu.onuId, cmOnu.onu.port))
    )
    .mapTo({ result: true, message: 'Onu restarted' })
    .toPromise()
);

const removeOnu = onuId => reader(
  ({ DB, eventLog }) => DB.onu.findById(onuId)
    .then(tap(entityExistsCheck(EntityEnum.Onu)))
    .then(tapP(DB.onu.remove))
    .then(eventLog.logDeviceInfoEvent(LogTypeEnum.DeviceDelete))
    .then(constant({ result: true, message: 'Onu deleted' }))
);

const resetInterfaceListStatistics = onuId => reader(
  ({ DB }) => {
    const dbDeviceP = DB.onu.findById(onuId)
      .then(tap(entityExistsCheck(EntityEnum.Onu)));
    const cmDeviceP = dbDeviceP
      .then(fromDbDevice({}));
    const cmInterfaceListP = allP([dbDeviceP, cmDeviceP])
      .then(([dbDevice, cmDevice]) => cmDevice
        .map(get(['interfaces']))
        .chain(fromDbInterfaceList({ dbDevice }))
      );

    return allP([cmDeviceP, cmInterfaceListP])
      .then(([cmDevice, cmInterfaceList]) => cmDevice
        .chain(merge(mergeInterfaces, cmInterfaceList
          .map(resetInterfaceListStatisticsAp)
          .chain(toDbInterfaceList)
        ))
        .chain(toDbDevice)
        .map(DB.onu.update)
        .map(thenP(constant({ result: true, message: 'Interface statistics reset' })))
        .cata(rejectP, resolveP)
      );
  }
);

const blockOnu = onuId => reader(
  ({ deviceStore, DB, firmwareDal }) => Observable
    .from(onuDetail.loadData(onuId).run({ deviceStore, DB, firmwareDal }))
    .mergeMap(cmOnu => Observable.of(deviceStore.get(cmOnu.onu.id))
      .do(entityExistsCheck(EntityEnum.Olt))
      .mergeMap(commOlt => commOlt.blockOnu(cmOnu))
    )
    .mapTo({ result: true, message: 'Onu Blocked' })
    .toPromise()
);

const unblockOnu = onuId => reader(
  ({ deviceStore, DB, firmwareDal }) => Observable
    .from(onuDetail.loadData(onuId).run({ deviceStore, DB, firmwareDal }))
    .mergeMap(cmOnu => Observable.of(deviceStore.get(cmOnu.onu.id))
      .do(entityExistsCheck(EntityEnum.Olt))
      .mergeMap(commOlt => commOlt.unblockOnu(cmOnu))
    )
    .mapTo({ result: true, message: 'Onu Unblocked' })
    .toPromise()
);

module.exports = {
  onuDetail,
  onuList,
  removeOnu,
  resetInterfaceListStatistics,
  restartOnu,
  blockOnu,
  unblockOnu,
  updateOnu,
};
