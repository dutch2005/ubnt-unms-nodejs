'use strict';

const { when, match } = require('ramda');
const { isArray } = require('ramda-adjunct');
const { flow, nth, first } = require('lodash/fp');

const { modelToPlatformIds } = require('../../../feature-detection/firmware');

// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = flow(match(/EdgeSwitch\.(.+?)\./), nth(1), modelToPlatformIds, when(isArray, first));

module.exports = {
  parsePlatformId,
};
