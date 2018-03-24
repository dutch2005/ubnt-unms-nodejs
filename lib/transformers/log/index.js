'use strict';


const { toCorrespondence, fromCorrespondence } = require('../index');
const {
  safeParseDbLogItem, safeParseDbLogItemList, safeParseDbLogAggregationItem, safeParseDbLogAggregationItemList,
} = require('./parsers');
const {
  safeToApiLogItem, safeToApiLogItemList, safeToApiLogAggregationItem, safeToApiLogAggregation,
  safeToApiLogPagination, safeToApiLogView,
} = require('./mappers');


// fromDbLogItem :: Auxiliaries -> DbLogItem -> Either.<LogItemCorrespondenceData>
//     Auxiliaries = Object
//     DbLogItem = Object
//     LogItemCorrespondenceData = Object
const fromDbLogItem = toCorrespondence(safeParseDbLogItem);

// fromDbLogItemList :: Auxiliaries -> Array.<DbLogItem> -> Either.<Array.<LogItemCorrespondenceData>>
//     Auxiliaries = Object
//     DbLogItem = Object
//     LogItemCorrespondenceData = Object
const fromDbLogItemList = toCorrespondence(safeParseDbLogItemList);

// fromDbLogAggregationItem :: Auxiliaries -> DbLogAggregationItem -> Either.<LogAggregationItemCorrespondenceData>
//     Auxiliaries = Object
//     DbLogAggregationItem = Object
//     LogAggregationItemCorrespondenceData = Object
const fromDbLogAggregationItem = toCorrespondence(safeParseDbLogAggregationItem);

// eslint-disable-next-line max-len
// fromDbLogAggregationItemList :: Auxiliaries -> Array.<DbLogAggregationItem> -> Either.<Array.<LogAggregationItemCorrespondenceData>>
//     Auxiliaries = Object
//     DbLogAggregationItem = Object
//     LogAggregationItemCorrespondenceData = Object
const fromDbLogAggregationItemList = toCorrespondence(safeParseDbLogAggregationItemList);

// toApiLogItem :: LogItemCorrespondenceData -> Either.<ApiLogItem>
//     LogItemCorrespondenceData = Object
//     ApiLogItem = Object
const toApiLogItem = fromCorrespondence(safeToApiLogItem);

// toApiLogItemList :: Array.<LogItemCorrespondenceData> -> Either.<Array.<ApiLogItem>>
//     LogItem
const toApiLogItemList = fromCorrespondence(safeToApiLogItemList);

// toApiLogAggregationItem :: LogAggregationItemCorrespondenceData -> Either.<ApiLogAggregationItem>
//     LogAggregationItemCorrespondenceData = Object
//     ApiLogAggregationItem = Object
const toApiLogAggregationItem = fromCorrespondence(safeToApiLogAggregationItem);

// toApiLogAggregation :: Array.<LogAggregationItemCorrespondenceData> -> Either.<ApiLogAggregation>
//     LogAggregationItemCorrespondenceData = Object
//     ApiLogAggregation = Object
const toApiLogAggregation = fromCorrespondence(safeToApiLogAggregation);

// toApiLogPagination :: LogPaginationCorrespondenceData -> Either.<ApiLogPagination>
//     LogPaginationCorrespondenceData = Object
//     ApiLogPagination = Object
const toApiLogPagination = fromCorrespondence(safeToApiLogPagination);

// toApiLogView :: LogViewCorrespondenceData -> Either.<ApiLogView>
//     LogViewCorrespondenceData = Object
//     ApiLogView = Object
const toApiLogView = fromCorrespondence(safeToApiLogView);


module.exports = {
  fromDbLogItem,
  fromDbLogItemList,
  fromDbLogAggregationItem,
  fromDbLogAggregationItemList,

  toApiLogItem,
  toApiLogItemList,
  toApiLogAggregationItem,
  toApiLogAggregation,
  toApiLogPagination,
  toApiLogView,
};
