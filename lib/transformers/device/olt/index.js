'use strict';

const { toCorrespondence, fromCorrespondence } = require('../../index');
const {
  safeParseHwOnuProfileList, safeParseApiOnuProfile, safeParseHwOnuList,
  safeParseApiOnuPolicies, safeParseHwOnuPolicies,
} = require('./parsers');
const { safeToApiOnuProfileList, safeToApiOnuPolicies } = require('./mappers');
const { mergeOnuCount } = require('./mergers');

// fromHwOnuProfileList :: HwOnuProfileList -> Either.<CmOnuProfileList>
const fromHwOnuProfileList = toCorrespondence(safeParseHwOnuProfileList, {});

// fromApiOnuProfile :: ApiOnuProfile -> Either.<CmOnuProfile>
const fromApiOnuProfile = toCorrespondence(safeParseApiOnuProfile, {});

// fromHwOnuList :: HwOnuList -> Either.<CmOnuList>
const fromHwOnuList = toCorrespondence(safeParseHwOnuList, {});

// toApiOnuProfileList :: CmOnuProfileList -> Either.<ApiOnuProfileList>
const toApiOnuProfileList = fromCorrespondence(safeToApiOnuProfileList);

// fromApiOnuPolicies :: ApiOnuPolicies -> Either.<CmOnuPolicies>
const fromApiOnuPolicies = toCorrespondence(safeParseApiOnuPolicies, {});

// fromHwOnuPolicies :: HwOnuPolicies -> Either.<CmOnuPolicies>
const fromHwOnuPolicies = toCorrespondence(safeParseHwOnuPolicies, {});

// toApiOnuPolicies :: CmOnuPolicies -> Either.<ApiOnuPolicies>
const toApiOnuPolicies = fromCorrespondence(safeToApiOnuPolicies);

module.exports = {
  fromHwOnuProfileList,
  fromApiOnuProfile,
  fromHwOnuList,

  toApiOnuProfileList,

  mergeOnuCount,
  fromApiOnuPolicies,
  fromHwOnuPolicies,
  toApiOnuPolicies,
};
