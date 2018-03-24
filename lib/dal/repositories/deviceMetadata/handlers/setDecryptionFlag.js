'use strict';

const { Reader: reader } = require('monet');

const { DeviceConnectionFailedReasonEnum } = require('../../../../enums');

module.exports = ({ deviceId, reason }, message) => reader(
  ({ dal, messageHub }) => {
    if (reason !== DeviceConnectionFailedReasonEnum.Decryption) { return }

    dal.deviceMetadataRepository
      .update({ id: deviceId, failedMessageDecryption: true })
      .catch(messageHub.logError(message));
  });
