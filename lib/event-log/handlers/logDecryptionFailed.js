'use strict';

const { Reader: reader } = require('monet');

const { LogTypeEnum, LogLevelEnum, DeviceConnectionFailedReasonEnum } = require('../../enums');

// eslint-disable-next-line valid-jsdoc
/**
 * @param {string} deviceId
 * @param {string} reason
 * @param {string} ipAddress
 * @param {Message} message
 * @return {Reader.<onDeviceFailedDecryptionHandler~callback>}
 */
module.exports = ({ deviceId, reason, ipAddress }, message) => reader(
  ({ eventLog, messageHub }) => {
    if (reason !== DeviceConnectionFailedReasonEnum.Decryption) { return }
    eventLog.logDeviceConnectionFail(
      deviceId,
      ipAddress,
      LogLevelEnum.Error,
      LogTypeEnum.DeviceConnectionFail,
      Date.now()
    ).catch(messageHub.logError(message));
  }
);
