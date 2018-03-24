'use strict';

const { safeToApi, safeToApiList } = require('./mappers');
const { safeParseFile, safeParseFileList } = require('./parsers');

const { toCorrespondence, fromCorrespondence } = require('../index');

// fromFile :: FileInfo -> Either.<Object>
//    FileInfo = Object
const fromFile = toCorrespondence(safeParseFile, {});

// toApi :: Correspondence -> Either.<Object>
//    Correspondence = Object
const toApi = fromCorrespondence(safeToApi);

// fromFileList :: FileList -> Either.<Array>
//    FileList = Array.<Object>
const fromFileList = toCorrespondence(safeParseFileList, {});

// toApiList :: CorrespondenceList -> Either.<Array>
//    CorrespondenceList = Array.<Object>
const toApiList = fromCorrespondence(safeToApiList);

module.exports = {
  fromFile,
  toApi,
  fromFileList,
  toApiList,
};
