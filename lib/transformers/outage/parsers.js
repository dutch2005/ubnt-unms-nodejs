'use strict';

const { map, pathEq, sum, assoc, propEq } = require('ramda');
const { getOr, find, flow, get, ceil, min, isUndefined } = require('lodash/fp');

const { liftParser } = require('../index');


// parseAllCount :: Array.<OutageAggregationItemCorrespondenceData> -> Number
//     OutageAggregationItemCorrespondenceData = Object
const parseAllCount = flow(map(get('count')), sum);

// parseTypeCount :: (Auxiliaries, Array.<OutageAggregationItemCorrespondenceData>) -> Number
//     Auxiliaries = { type: String }
//     OutageAggregationItemCorrespondenceData = Object
const parseTypeCount = ({ type }, cmOutageAggregationItemList) => {
  if (isUndefined(type)) { return parseAllCount(cmOutageAggregationItemList) }

  return flow(find(pathEq(['type'], type)), getOr(0, ['count']))(cmOutageAggregationItemList);
};

// parseDbOutageSite :: (siteMap, dbOutageSite) -> dbOutageSite
//    siteMap = Object
//    dbOutageSite = Object
const parseDbOutageSite = (siteMap, dbOutageSite) => (isUndefined(dbOutageSite.id)
  ? {}
  : getOr({}, ['identification'], siteMap[dbOutageSite.id])
);

// parseDeviceMetadata :: (Auxiliaries, dbDevice) -> deviceMetadataCorrenspondenceData
//    Auxiliaries = Object
//    dbDevice = Object
const parseDeviceMetadata = ({ dbDeviceMetadataList }, device) => {
  const deviceMetadata = find(propEq('id', device.id), dbDeviceMetadataList);
  const alias = getOr(null, ['alias'], deviceMetadata);
  return { alias };
};

// parseDbOutageItem :: (Auxiliaries, DbOutageItem) -> OutageItemCorrespondenceData
//     Auxiliaries = Object
//     DbOutageItem = Object
const parseDbOutageItem = (auxiliaries, dbOutageItem) => {
  const dbOutageSite = parseDbOutageSite(auxiliaries.siteMap, dbOutageItem.site);
  const outage = {
    id: dbOutageItem.id,
    type: dbOutageItem.type,
    startTimestamp: dbOutageItem.startTimestamp,
    endTimestamp: dbOutageItem.endTimestamp,
    aggregatedTime: dbOutageItem.endTimestamp - dbOutageItem.startTimestamp,
    site: dbOutageSite,
    device: assoc('site', dbOutageSite, dbOutageItem.device),
    deviceMetadata: parseDeviceMetadata(auxiliaries, dbOutageItem.device),
  };

  return auxiliaries.outageIdsInProgress.includes(dbOutageItem.id) ? assoc('inProgress', true, outage) : outage;
};

// parseDbOutageItemList :: (Auxiliaries, Array.<DbOutageItem>) -> Array.<OutageItemCorrespondenceData>
const parseDbOutageItemList = (auxiliaires, dbOutageItemList) =>
  map(parseDbOutageItem.bind(null, auxiliaires), dbOutageItemList);

// parseDbOutageAggregationItem :: (Auxiliaries, DbOutageAggregationItem) -> OutageAggregationItemCorrespondenceData
const parseDbOutageAggregationItem = (auxiliaries, dbOutageAggregationItem) => ({
  type: dbOutageAggregationItem.type,
  count: dbOutageAggregationItem.count,
});

/* eslint-disable max-len */
// parseDbOutageAggregationItemList :: (Auxiliaries, Array.<DbOutageAggregationItem>) -> Array.<OutageAggregationItemCorrespondenceData>
const parseDbOutageAggregationItemList = (auxiliaries, dbOutageAggregationItemList) =>
  map(parseDbOutageAggregationItem.bind(null, auxiliaries), dbOutageAggregationItemList);

// parseOutagePagination :: (Auxiliaries, Array.<OutageAggregationItemCorrespondenceData>) -> OutagePaginationCorrespondenceData
//     Auxiliaries = { type: String, limit: Number, currentPage: Number }
//     OutageAggregationItemCorrespondenceData = Object
//     OutagePaginationCorrespondenceData = { total: Number, count: Number, page: Number, pages: Number }
const parseOutagePagination = ({ type, limit, currentPage }, cmOutageAggregationItemList) => {
  const allCount = parseAllCount(cmOutageAggregationItemList);
  const typeCount = parseTypeCount({ type }, cmOutageAggregationItemList);
  const pages = ceil(allCount / limit);
  const safeCurrentPage = min([currentPage, pages]);

  return { total: typeCount, count: limit, page: safeCurrentPage, pages };
};

// parseOutageView :: (Auxiliaries, Array.<DbOutageItem>) -> OutageViewCorrespondenceData
//     Auxiliaries = { dbOutageAggregationItemList: Array.<DbOutageAggregationItem>, dbDeviceMetadataList: Array.<dbDeviceMetadataItem>, type: String, limit: Number, currentPage: Number }
//     DbOutageAggregationItem = Object
//     DbOutageItem = Object
const parseOutageView = (
  {
    outageIdsInProgress,
    siteMap,
    dbOutageAggregationItemList,
    type,
    limit,
    currentPage,
    dbDeviceMetadataList,
  }, dbOutageItemList
) => {
  const cmOutageItemList = parseDbOutageItemList({
    outageIdsInProgress, siteMap, dbDeviceMetadataList,
  }, dbOutageItemList);
  const cmOutageAggregationItemList = parseDbOutageAggregationItemList({}, dbOutageAggregationItemList);
  const cmOutagePagination = parseOutagePagination({ type, limit, currentPage }, cmOutageAggregationItemList);

  return {
    itemList: cmOutageItemList,
    aggregationItemList: cmOutageAggregationItemList,
    pagination: cmOutagePagination,
  };
};
/* eslint-enable max-len */


module.exports = {
  parseAllCount,
  parseTypeCount,
  parseDbOutageItem,
  parseDbOutageItemList,
  parseDbOutageAggregationItem,
  parseDbOutageAggregationItemList,
  parseOutagePagination,
  parseOutageView,

  safeParseDbOutageItem: liftParser(parseDbOutageItem),
  safeParseDbOutageItemList: liftParser(parseDbOutageItemList),
  safeParseDbOutageAggregationItem: liftParser(parseDbOutageAggregationItem),
  safeParseDbOutageAggregationItemList: liftParser(parseDbOutageAggregationItemList),
  safeParseOutagePagination: liftParser(parseOutagePagination),
  safeParseOutageView: liftParser(parseOutageView),
};
