'use strict';

const { safeToApi, safeToApiList } = require('./mappers');
const { safeParseDb, safeParseDbList } = require('./parsers');

const { toCorrespondence, fromCorrespondence } = require('../index');

// fromDb :: DbTaskBatch -> Either.<Object>
//    DbTaskBatch = Object
const fromDb = toCorrespondence(safeParseDb, {});

// toApi :: Correspondence -> Either.<Object>
//    Correspondence = Object
const toApi = fromCorrespondence(safeToApi);

// fromDbList :: DbTaskBatchList -> Object -> Either.<Array>
//    DbTaskBatchList = Object
const fromDbList = toCorrespondence(safeParseDbList);

// toApiList :: CorrespondenceList -> Either.<Array>
//    CorrespondenceList = Object
const toApiList = fromCorrespondence(safeToApiList);

module.exports = {
  fromDb,
  toApi,
  fromDbList,
  toApiList,
};
