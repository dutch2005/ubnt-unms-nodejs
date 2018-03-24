'use strict';

const { Reader: reader } = require('monet');
const { pathEq, pathSatisfies, ifElse, assocPath } = require('ramda');
const {
  isNil, reject, flow, keyBy, groupBy, mapValues, get, map, constant, identity, every, assign, filter, isEmpty,
} = require('lodash/fp');
const { cata } = require('ramda-adjunct');

const { fromDbList: fromDbSiteList, fromDb: fromDbSite, toDb: toDbSite } = require('../transformers/site');
const { fromDbList: fromDbDeviceList } = require('../transformers/device');
const { allP, rejectP, resolveP } = require('../util');
const { StatusEnum } = require('../enums');

const calculateSiteStatus = flow(
  every(pathEq(['overview', 'status'], StatusEnum.Active)),
  ifElse(identity, constant(StatusEnum.Active), constant(StatusEnum.Disconnected))
);

const isDeviceInSite = pathEq(['identification', 'siteId']);

const synchronizeSitesStatus = () => reader(
  ({ DB, deviceStore, logging }) => allP([
    DB.site.list().then(fromDbSiteList({})).then(cata(rejectP, resolveP)),
    DB.device.list().then(fromDbDeviceList({ deviceStore })).then(cata(rejectP, resolveP)),
  ])
    .then(([cmSiteList, cmDeviceList]) => {
      const sitesById = keyBy(get(['identification', 'id']), cmSiteList);
      const siteStatus = flow(
        reject(pathSatisfies(isNil, ['identification', 'siteId'])),
        groupBy(get(['identification', 'siteId'])),
        mapValues(calculateSiteStatus),
        assign(mapValues(constant(StatusEnum.Inactive), sitesById))
      )(cmDeviceList);

      return cmSiteList
        .filter((cmSite) => {
          const newStatus = siteStatus[cmSite.identification.id];
          return cmSite.identification.status !== newStatus;
        })
        .map(cmSite => assocPath(['identification', 'status'], siteStatus[cmSite.identification.id], cmSite));
    })
    .then(map(toDbSite))
    .then(map(cata(rejectP, DB.site.update)))
    .then(allP)
    .catch(error => logging.error('Failed to synchronize sites status', error))
);

const synchronizeSiteStatus = siteId => reader(
  ({ DB, deviceStore, logging }) => allP([
    DB.site.findById(siteId).then(fromDbSite({})).then(cata(rejectP, resolveP)),
    DB.device.list()
      .then(fromDbDeviceList({ deviceStore }))
      .then(cata(rejectP, resolveP))
      .then(filter(isDeviceInSite(siteId))),
  ])
    .then(([cmSite, cmDeviceList]) => {
      const status = isEmpty(cmDeviceList) ? StatusEnum.Inactive : calculateSiteStatus(cmDeviceList);
      if (cmSite.identification.status !== status) {
        return toDbSite(assocPath(['identification', 'status'], status, cmSite))
          .cata(rejectP, DB.site.update);
      }
      return resolveP();
    })
    .catch(error => logging.error('Failed to synchronize sites status', error))
);

module.exports = {
  synchronizeSitesStatus,
  synchronizeSiteStatus,
};
