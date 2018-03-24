'use strict';

const { liftMapper } = require('../../index');
const { pick, map } = require('lodash/fp');

// toApiOnuProfilesList :: cmOnuProfilesList -> Object
//    cmOnuProfilesList = Object
const toApiOnuProfileList = map(pick(['id', 'name', 'mode', 'adminPassword', 'bridge', 'router', 'onuCount']));

// toApiOnuPolicies :: CmOnuPolicies -> Object
//    CmOnuPolicies = Object
const toApiOnuPolicies = pick(['defaultState']);

module.exports = {
  toApiOnuProfileList,
  toApiOnuPolicies,

  safeToApiOnuProfileList: liftMapper(toApiOnuProfileList),
  safeToApiOnuPolicies: liftMapper(toApiOnuPolicies),
};
