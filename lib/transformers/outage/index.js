'use strict';


const { toCorrespondence, fromCorrespondence } = require('../index');
const {
  safeParseDbOutageItem, safeParseDbOutageItemList, safeParseDbOutageAggregationItem,
  safeParseDbOutageAggregationItemList,
} = require('./parsers');
const {
  safeToApiOutageItem, safeToApiOutageItemList, safeToApiOutageAggregationItem, safeToApiOutageAggregation,
  safeToApiOutagePagination, safeToApiOutageView,
} = require('./mappers');


// fromDbOutageItem :: Auxiliaries -> DbOutageItem -> Either.<OutageItemCorrespondenceData>
//     Auxiliaries = Object
//     DbOutageItem = Object
//     OutageItemCorrespondenceData = Object
const fromDbOutageItem = toCorrespondence(safeParseDbOutageItem);

// fromDbOutageItemList :: Auxiliaries -> Array.<DbOutageItem> -> Either.<Array.<OutageItemCorrespondenceData>>
//     Auxiliaries = Object
//     DbOutageItem = Object
//     OutageItemCorrespondenceData = Object
const fromDbOutageItemList = toCorrespondence(safeParseDbOutageItemList);

// eslint-disable-next-line max-len
// fromDbOutageAggregationItem :: Auxiliaries -> DbOutageAggregationItem -> Either.<OutageAggregationItemCorrespondenceData>
//     Auxiliaries = Object
//     DbOutageAggregationItem = Object
//     OutageAggregationItemCorrespondenceData = Object
const fromDbOutageAggregationItem = toCorrespondence(safeParseDbOutageAggregationItem);

// eslint-disable-next-line max-len
// fromDbOutageAggregationItemList :: Auxiliaries -> Array.<DbOutageAggregationItem> -> Either.<Array.<OutageAggregationItemCorrespondenceData>>
//     Auxiliaries = Object
//     DbOutageAggregationItem = Object
//     OutageAggregationItemCorrespondenceData = Object
const fromDbOutageAggregationItemList = toCorrespondence(safeParseDbOutageAggregationItemList);

// toApiOutageItem :: OutageItemCorrespondenceData -> Either.<ApiOutageItem>
//     OutageItemCorrespondenceData = Object
//     ApiOutageItem = Object
const toApiOutageItem = fromCorrespondence(safeToApiOutageItem);

// toApiOutageItemList :: Array.<OutageItemCorrespondenceData> -> Either.<Array.<ApiOutageItem>>
//     OutageItem
const toApiOutageItemList = fromCorrespondence(safeToApiOutageItemList);

// toApiOutageAggregationItem :: OutageAggregationItemCorrespondenceData -> Either.<ApiOutageAggregationItem>
//     OutageAggregationItemCorrespondenceData = Object
//     ApiOutageAggregationItem = Object
const toApiOutageAggregationItem = fromCorrespondence(safeToApiOutageAggregationItem);

// toApiOutageAggregation :: Array.<OutageAggregationItemCorrespondenceData> -> Either.<ApiOutageAggregation>
//     OutageAggregationItemCorrespondenceData = Object
//     ApiOutageAggregation = Object
const toApiOutageAggregation = fromCorrespondence(safeToApiOutageAggregation);

// toApiOutagePagination :: OutagePaginationCorrespondenceData -> Either.<ApiOutagePagination>
//     OutagePaginationCorrespondenceData = Object
//     ApiOutagePagination = Object
const toApiOutagePagination = fromCorrespondence(safeToApiOutagePagination);

// toApiOutageView :: OutageViewCorrespondenceData -> Either.<ApiOutageView>
//     OutageViewCorrespondenceData = Object
//     ApiOutageView = Object
const toApiOutageView = fromCorrespondence(safeToApiOutageView);


module.exports = {
  fromDbOutageItem,
  fromDbOutageItemList,
  fromDbOutageAggregationItem,
  fromDbOutageAggregationItemList,

  toApiOutageItem,
  toApiOutageItemList,
  toApiOutageAggregationItem,
  toApiOutageAggregation,
  toApiOutagePagination,
  toApiOutageView,
};
