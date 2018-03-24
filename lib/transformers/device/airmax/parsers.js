'use strict';

const { match } = require('ramda');
const { flow, nth } = require('lodash/fp');


// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = flow(match(/^(\w+)\./), nth(1));

module.exports = {
  parsePlatformId,
};
