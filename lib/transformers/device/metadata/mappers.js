'use strict';

const { isEmpty } = require('lodash/fp');

const { liftMapper } = require('../../index');
const dal = require('../../../dal');
const { defaultToWhen } = require('../../../util');


// toDbDeviceMetadata :: CorrespondenceDeviceMetadata -> DbDeviceMetadata
//     CorrespondenceDeviceMetadata = Object
//     DbDeviceMetadata = Object
const toDbDeviceMetadata = correspondenceData => dal.sequelize.models.deviceMetadataModel
  .build({
    id: correspondenceData.id,
    failedMessageDecryption: correspondenceData.failedMessageDecryption,
    restartTimestamp: correspondenceData.restartTimestamp,
    alias: defaultToWhen(isEmpty, null, correspondenceData.alias),
    note: defaultToWhen(isEmpty, null, correspondenceData.note),
  })
  .get();

// toApiDeviceMetadata :: CorrespondenceDeviceMetadata -> ApiDeviceMetadata
//     CorrespondenceDeviceMetadata = Object
//     ApiDeviceMetadata = Object
const toApiDeviceMetadata = correspondenceData => ({
  failedMessageDecryption: correspondenceData.failedMessageDecryption,
  restartTimestamp: correspondenceData.restartTimestamp,
  alias: correspondenceData.alias,
  note: correspondenceData.note,
});

module.exports = {
  toDbDeviceMetadata,
  toApiDeviceMetadata,

  safeToDbDeviceMetadata: liftMapper(toDbDeviceMetadata),
  safeToApiDeviceMetadata: liftMapper(toApiDeviceMetadata),
};

