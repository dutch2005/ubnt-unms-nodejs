'use strict';

const { Reader: reader } = require('monet');

module.exports = ({ deviceId }, message) => reader(
  ({ dal, messageHub }) => dal.deviceMetadataRepository.remove(deviceId)
    .catch(messageHub.logError(message))
);
