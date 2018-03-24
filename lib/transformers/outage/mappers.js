'use strict';

const { transduce, merge, map } = require('ramda');

const { liftMapper } = require('../index');
const { parseAllCount } = require('./parsers');


// toApiOutageItem :: Object -> ApiOutageItem
//     ApiOutageItem = Object
const toApiOutageItem = correspondenceData => ({
  id: correspondenceData.id,
  startTimestamp: correspondenceData.startTimestamp,
  endTimestamp: correspondenceData.endTimestamp,
  aggregatedTime: correspondenceData.aggregatedTime,
  type: correspondenceData.type,
  inProgress: correspondenceData.inProgress,
  device: correspondenceData.device,
  deviceMetadata: correspondenceData.deviceMetadata,
  site: correspondenceData.site,
});

// toApiOutageItemList :: Array.<OutageItemCorrespondenceData> -> Array.<ApiOutageItem>
//     OutageItemCorrespondenceData = Object
const toApiOutageItemList = map(toApiOutageItem);

// toApiOutageAggregationItem :: OutageAggregationItemCorrespondenceData -> ApiOutageAggregationItem
//     OutageAggregationItemCorrespondenceData = Object
//     ApiOutageAggregationItem = Object
const toApiOutageAggregationItem = cmOutageAggregationItem => ({
  [`${cmOutageAggregationItem.type}Count`]: cmOutageAggregationItem.count,
});

// toApiOutageAggregation :: Array.<OutageAggregationItemCorrespondenceData> -> toApiOutageAggregation
//     OutageAggregationItemCorrespondenceData = Object
//     toApiOutageAggregation = Object
const toApiOutageAggregation = (cmOutageAggregationList) => {
  const allCount = parseAllCount(cmOutageAggregationList);
  const aggregationCounts = transduce(map(toApiOutageAggregationItem), merge, {}, cmOutageAggregationList);

  return merge({
    allCount,
    outageCount: 0,
    qualityCount: 0,
  }, aggregationCounts);
};

// toApiOutagePagination :: OutagePaginationCorrespondenceData -> ApiOutagePagination
//     OutagePaginationCorrespondenceData = Object
//     ApiOutagePagination = Object
const toApiOutagePagination = cmPagination => ({
  total: cmPagination.total,
  count: cmPagination.count,
  page: cmPagination.page,
  pages: cmPagination.pages,
});

// toApiOutageView :: OutageViewCorrespondenceData -> ApiOutageView
//     OutageViewCorrespondenceData = Object
//     ApiOutageView = Object
const toApiOutageView = cmOutageView => ({
  items: toApiOutageItemList(cmOutageView.itemList),
  aggregation: toApiOutageAggregation(cmOutageView.aggregationItemList),
  pagination: toApiOutagePagination(cmOutageView.pagination),
});


module.exports = {
  toApiOutageItem,
  toApiOutageItemList,
  toApiOutageAggregationItem,
  toApiOutageAggregation,
  toApiOutagePagination,
  toApiOutageView,

  safeToApiOutageItem: liftMapper(toApiOutageItem),
  safeToApiOutageItemList: liftMapper(toApiOutageItemList),
  safeToApiOutageAggregationItem: liftMapper(toApiOutageAggregationItem),
  safeToApiOutageAggregation: liftMapper(toApiOutageAggregation),
  safeToApiOutagePagination: liftMapper(toApiOutagePagination),
  safeToApiOutageView: liftMapper(toApiOutageView),
};
