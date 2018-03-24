'use strict';

const { Reader: reader } = require('monet');

module.exports = ({ deviceId }, message) => reader(
  ({ dal, messageHub }) => dal.deviceMetadataRepository
    .update({ id: deviceId, restartTimestamp: null })
    .catch(messageHub.logError(message))
);
