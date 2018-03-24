'use strict';

const { Reader: reader } = require('monet');

const { LogTypeEnum } = require('../../enums');

/**
 * @param {CorrespondenceDevice} device
 * @param {Message} message
 * @return {Reader.<onDeviceRemoveHandler~callback>}
 */
module.exports = ({ device }, message) => reader(
  ({ eventLog, messageHub }) => eventLog.logDeviceInfoEvent(LogTypeEnum.DeviceDelete, device)
    .catch(messageHub.logError(message))
);
