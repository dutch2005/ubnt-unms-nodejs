'use strict';

const { Reader: reader } = require('monet');

const { toDbDeviceMetadata } = require('../../../../transformers/device/metadata/mappers');

module.exports = ({ deviceId, isNew }, message) => reader(
  ({ dal, messageHub }) => {
    if (!isNew) { return }

    dal.deviceMetadataRepository
      .save(toDbDeviceMetadata({ id: deviceId }))
      .catch(messageHub.logError(message));
  }
);
