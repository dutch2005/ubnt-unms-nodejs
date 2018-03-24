'use strict';

const { safeToDbDeviceMetadata, safeToApiDeviceMetadata } = require('./mappers');
const { safeParseDbDeviceMetadata, safeParseDbDeviceMetadataList } = require('./parsers');
const { toCorrespondence, fromCorrespondence } = require('../../index');

/**
 * Device metadata correspondence
 *
 * @typedef {Object} DeviceMetadataCorrespondence
 * @property {string} id
 * @property {boolean} failedDeviceDecryption
 * @property {string} alias
 * @property {string} note
 */

// fromDb :: Auxiliaries -> DbDeviceMetadata -> Either.<Object>
//     Auxiliaries = Object
//     DbDeviceMetadata = Object
const fromDb = toCorrespondence(safeParseDbDeviceMetadata);

// fromDbList :: Auxiliaries -> Array.<DbDeviceMetadata> -> Either.<Object>
//     Auxiliaries = Object
//     DbDeviceMetadata = Object
const fromDbList = toCorrespondence(safeParseDbDeviceMetadataList);

// toDb :: Auxiliaries -> CorrespondenceDeviceMetadata -> Either.<Object>
//     Auxiliaries = Object
//     CorrespondenceDeviceMetadata = Object
const toDb = fromCorrespondence(safeToDbDeviceMetadata);

// toApi :: Auxiliaries -> CorrespondenceDeviceMetadata -> Either.<Object>
//     Auxiliaries = Object
//     CorrespondenceDeviceMetadata = Object
const toApi = fromCorrespondence(safeToApiDeviceMetadata);

module.exports = {
  fromDb,
  fromDbList,

  toDb,
  toApi,
};
