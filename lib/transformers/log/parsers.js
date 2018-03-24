'use strict';

const { map, pathEq, sum, propEq } = require('ramda');
const { getOr, find, flow, get, ceil, min, isUndefined } = require('lodash/fp');

const { liftParser } = require('../index');


// parseAllCount :: Array.<LogAggregationItemCorrespondenceData> -> Number
//     LogAggregationItemCorrespondenceData = Object
const parseAllCount = flow(map(get('count')), sum);

// parseLevelCount :: (Auxiliaries, Array.<LogAggregationItemCorrespondenceData>) -> Number
//     Auxiliaries = { level: String }
//     LogAggregationItemCorrespondenceData = Object
const parseLevelCount = ({ level }, cmLogAggregationItemList) => {
  if (isUndefined(level)) { return parseAllCount(cmLogAggregationItemList) }

  return flow(find(pathEq(['level'], level)), getOr(0, ['count']))(cmLogAggregationItemList);
};

// parseDeviceMetadata :: (Auxiliaries, dbDevice) -> deviceMetadataCorrenspondenceData
//    Auxiliaries = Object
//    dbDevice = Object
const parseDeviceMetadata = ({ dbDeviceMetadataList }, device) => {
  const deviceMetadata = find(propEq('id', device.id), dbDeviceMetadataList);
  const alias = getOr(null, ['alias'], deviceMetadata);
  return { alias };
};

// parseDbLogItem :: (Auxiliaries, DbLogItem) -> LogItemCorrespondenceData
//     Auxiliaries = Object
//     DbLogItem = Object
const parseDbLogItem = (auxiliaries, dbLogItem) => ({
  id: dbLogItem.id,
  message: dbLogItem.message,
  level: dbLogItem.level,
  type: dbLogItem.type,
  timestamp: dbLogItem.timestamp,
  site: dbLogItem.site, // just pass it along. format of this data is unknown
  device: dbLogItem.device, // just pass it along. format of this data is unknown
  deviceMetadata: parseDeviceMetadata(auxiliaries, dbLogItem.device),
  tags: dbLogItem.tags,
  mailNotificationEmails: dbLogItem.mailNotificationEmails,
  mailNotificationTimestamp: dbLogItem.mailNotificationTimestamp,
  remoteAddress: dbLogItem.remoteAddress,
  user: dbLogItem.user,
  token: dbLogItem.token,
});

// parseDbLogItemList :: (Auxiliaries, Array.<DbLogItem>) -> Array.<LogItemCorrespondenceData>
const parseDbLogItemList = (auxiliaries, dbLogItemList) => map(parseDbLogItem.bind(null, auxiliaries), dbLogItemList);

// parseDbLogAggregationItem :: (Auxiliaries, DbLogAggregationItem) -> LogAggregationItemCorrespondenceData
const parseDbLogAggregationItem = (auxiliaries, dbLogAggregationItem) => ({
  level: dbLogAggregationItem.level,
  count: dbLogAggregationItem.count,
});

/* eslint-disable max-len */
// parseDbLogAggregationItemList :: (Auxiliaries, Array.<DbLogAggregationItem>) -> Array.<LogAggregationItemCorrespondenceData>
const parseDbLogAggregationItemList = (auxiliaries, dbLogAggregationItemList) =>
  map(parseDbLogAggregationItem.bind(null, auxiliaries), dbLogAggregationItemList);
/* eslint-enable max-len */

// parseLogPagination :: (Auxiliaries, Array.<LogAggregationItemCorrespondenceData>) -> LogPaginationCorrespondenceData
//     Auxiliaries = { level: String, limit: Number, currentPage: Number }
//     LogAggregationItemCorrespondenceData = Object
//     LogPaginationCorrespondenceData = { total: Number, count: Number, page: Number, pages: Number }
const parseLogPagination = ({ level, limit, currentPage }, cmLogAggregationItemList) => {
  const allCount = parseAllCount(cmLogAggregationItemList);
  const levelCount = parseLevelCount({ level }, cmLogAggregationItemList);
  const pages = ceil(allCount / limit);
  const safeCurrentPage = min([currentPage, pages]);

  return { total: levelCount, count: limit, page: safeCurrentPage, pages };
};

/* eslint-disable max-len */
// parseLogView :: (Auxiliaries, Array.<DbLogItem>) -> LogViewCorrespondenceData
//     Auxiliaries = { dbLogAggregationItemList: Array.<DbLogAggregationItem>, dbDeviceMetadataList: Array.<DbDeviceMetadataItem>, level: String, limit: Number, currentPage: Number }
//     DbLogAggregationItem = Object
//     DbLogItem = Object
const parseLogView = ({ dbLogAggregationItemList, level, limit, currentPage, dbDeviceMetadataList }, dbLogItemList) => {
  const cmLogItemList = parseDbLogItemList({ dbDeviceMetadataList }, dbLogItemList);
  const cmLogAggregationItemList = parseDbLogAggregationItemList({}, dbLogAggregationItemList);
  const cmLogPagination = parseLogPagination({ level, limit, currentPage }, cmLogAggregationItemList);

  return {
    itemList: cmLogItemList,
    aggregationItemList: cmLogAggregationItemList,
    pagination: cmLogPagination,
  };
};
/* eslint-enable max-len */


module.exports = {
  parseAllCount,
  parseLevelCount,
  parseDbLogItem,
  parseDbLogItemList,
  parseDbLogAggregationItem,
  parseDbLogAggregationItemList,
  parseLogPagination,
  parseLogView,

  safeParseDbLogItem: liftParser(parseDbLogItem),
  safeParseDbLogItemList: liftParser(parseDbLogItemList),
  safeParseDbLogAggregationItem: liftParser(parseDbLogAggregationItem),
  safeParseDbLogAggregationItemList: liftParser(parseDbLogAggregationItemList),
  safeParseLogPagination: liftParser(parseLogPagination),
  safeParseLogView: liftParser(parseLogView),
};
