'use strict';

const { transduce, merge, map } = require('ramda');
const moment = require('moment-timezone');

const { liftMapper } = require('../index');
const { parseAllCount } = require('./parsers');


// toApiLogItem :: Object -> ApiLogItem
//     ApiLogItem = Object
const toApiLogItem = correspondenceData => ({
  id: correspondenceData.id,
  timestamp: moment(correspondenceData.timestamp).toISOString(),
  message: correspondenceData.message,
  level: correspondenceData.level,
  tags: correspondenceData.tags,
  device: correspondenceData.device, // just pass it along. format of this data is unknown
  deviceMetadata: correspondenceData.deviceMetadata, // just pass it along. format of this data is unknown
  site: correspondenceData.site, // just pass it along. format of this data is unknown
});

// toApiLogItemList :: Array.<LogItemCorrespondenceData> -> Array.<ApiLogItem>
//     LogItemCorrespondenceData = Object
const toApiLogItemList = map(toApiLogItem);

// toApiLogAggregationItem :: LogAggregationItemCorrespondenceData -> ApiLogAggregationItem
//     LogAggregationItemCorrespondenceData = Object
//     ApiLogAggregationItem = Object
const toApiLogAggregationItem = cmLogAggregationItem => ({
  [`${cmLogAggregationItem.level}Count`]: cmLogAggregationItem.count,
});

// toApiLogAggregation :: Array.<LogAggregationItemCorrespondenceData> -> toApiLogAggregation
//     LogAggregationItemCorrespondenceData = Object
//     toApiLogAggregation = Object
const toApiLogAggregation = (cmLogAggregationList) => {
  const allCount = parseAllCount(cmLogAggregationList);
  const aggregationCounts = transduce(map(toApiLogAggregationItem), merge, {}, cmLogAggregationList);

  return merge({
    allCount,
    infoCount: 0,
    warningCount: 0,
    errorCount: 0,
  }, aggregationCounts);
};

// toApiLogPagination :: LogPaginationCorrespondenceData -> ApiLogPagination
//     LogPaginationCorrespondenceData = Object
//     ApiLogPagination = Object
const toApiLogPagination = cmPagination => ({
  total: cmPagination.total,
  count: cmPagination.count,
  page: cmPagination.page,
  pages: cmPagination.pages,
});

// toApiLogView :: LogViewCorrespondenceData -> ApiLogView
//     LogViewCorrespondenceData = Object
//     ApiLogView = Object
const toApiLogView = cmLogView => ({
  items: toApiLogItemList(cmLogView.itemList),
  aggregation: toApiLogAggregation(cmLogView.aggregationItemList),
  pagination: toApiLogPagination(cmLogView.pagination),
});


module.exports = {
  toApiLogItem,
  toApiLogItemList,
  toApiLogAggregationItem,
  toApiLogAggregation,
  toApiLogPagination,
  toApiLogView,

  safeToApiLogItem: liftMapper(toApiLogItem),
  safeToApiLogItemList: liftMapper(toApiLogItemList),
  safeToApiLogAggregationItem: liftMapper(toApiLogAggregationItem),
  safeToApiLogAggregation: liftMapper(toApiLogAggregation),
  safeToApiLogPagination: liftMapper(toApiLogPagination),
  safeToApiLogView: liftMapper(toApiLogView),
};
