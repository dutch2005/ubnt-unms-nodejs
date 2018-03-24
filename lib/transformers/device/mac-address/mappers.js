'use strict';

const { identity, map } = require('lodash/fp');

const { liftMapper } = require('../../index');


// toApiMacAddress :: CorrespondenceData -> String
//     CorrespondenceData = Object
const toApiMacAddress = identity;

// toApiMacAddressList :: CorrespondenceList -> String[]
//     CorrespondenceList = Array.<CorrespondenceData>
const toApiMacAddressList = map(toApiMacAddress);


module.exports = {
  toApiMacAddress,
  toApiMacAddressList,

  safeToApiMacAddress: liftMapper(toApiMacAddress),
  safeToApiMacAddressList: liftMapper(toApiMacAddressList),
};
