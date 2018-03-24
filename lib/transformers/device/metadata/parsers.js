'use strict';

const { curry, map, getOr } = require('lodash/fp');

const { liftParser } = require('../../index');

// parseDbDeviceMetadata :: Object -> DbDeviceMetadata -> CorrespondenceData
//     DbDeviceMetadata = Object
//     CorrespondenceData = Object
const parseDbDeviceMetadata = curry((auxiliaries, dbDeviceMetadata) => ({
  id: dbDeviceMetadata.id,
  failedMessageDecryption: dbDeviceMetadata.failedMessageDecryption,
  restartTimestamp: dbDeviceMetadata.restartTimestamp,
  alias: getOr(null, ['alias'], dbDeviceMetadata),
  note: getOr(null, ['note'], dbDeviceMetadata),
}));

// parseDbDeviceMetadataList :: (Object, Array.<DbDeviceMetadata>) -> Array.<Correspondence>
//     DbDeviceMetadata = Object
//     Correspondence = Object
const parseDbDeviceMetadataList = (auxiliaries, dbDeviceMetadataList) =>
  map(parseDbDeviceMetadata(auxiliaries), dbDeviceMetadataList);

module.exports = {
  parseDbDeviceMetadata,
  parseDbDeviceMetadataList,

  safeParseDbDeviceMetadata: liftParser(parseDbDeviceMetadata),
  safeParseDbDeviceMetadataList: liftParser(parseDbDeviceMetadataList),
};
