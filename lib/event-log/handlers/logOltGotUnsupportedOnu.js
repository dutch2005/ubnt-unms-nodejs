'use strict';

const { Reader: reader } = require('monet');

const { LogTypeEnum } = require('../../enums');

// eslint-disable-next-line valid-jsdoc
/**
 * @param {string} deviceId
 * @param {Object} device
 * @param {Message} message
 * @return {Reader.<onOltGotUnsupportedOnu~callback>}
 */
module.exports = ({ deviceId, device }, message) => reader(
  ({ eventLog, messageHub }) => {
    eventLog.logDeviceWarningEvent(LogTypeEnum.OltGotUnsupportedOnu, device)
      .catch(messageHub.logError(message));
  }
);

