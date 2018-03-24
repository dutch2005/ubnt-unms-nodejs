'use strict';

const parsers = require('./parsers');
const mappers = require('./mappers');
const { toCorrespondence, fromCorrespondence } = require('../../index');

// fromDb :: Auxiliaries -> DbDiscoveryResult -> Either.<CmDiscoveryResult>
//     Auxiliaries = Object
//     DbDiscoveryResult = Object
const fromDb = toCorrespondence(parsers.safeParseDbDiscoveryResult);

// fromDb :: Auxiliaries -> DbDiscoveryResultList -> Either.<Array.<CmDiscoveryResult>>>
//     Auxiliaries = Object
//     DbDiscoveryResultList = Array.<Object>
const fromDbList = toCorrespondence(parsers.safeParseDbDiscoveryResultList);

// fromApiPayload :: Auxiliaries -> DbDiscoveryResultPayload -> Either.<Object>
//     Auxiliaries = Object
//     DbDiscoveryResultPayload = Object
const fromApiPayload = toCorrespondence(parsers.safeParseApiDiscoveryResultPayload);

// toApi :: CorrespondenceDiscoveryResult -> Either.<Object>
//     Auxiliaries = Object
//     CorrespondenceDiscoveryResult = Object
const toApi = fromCorrespondence(mappers.safeToApiDiscoveryResult);

// toDb :: CorrespondenceDiscoveryResult -> Either.<Object>
//     Auxiliaries = Object
//     CorrespondenceDiscoveryResult = Object
const toDb = fromCorrespondence(mappers.safeToDbDiscoveryResult);

module.exports = {
  fromDb,
  fromDbList,
  fromApiPayload,
  toApi,
  toDb,
};
