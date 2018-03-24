'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {CorrespondenceDevice} cmDevice
 * @param {Message} message
 * @return {Reader.<onDeviceConnectedHandler~callback>}
 */
module.exports = ({ deviceId }, message) => reader(
  ({ outages, messageHub }) => {
    try {
      outages.deviceConnected(Date.now(), deviceId);
    } catch (error) {
      messageHub.logError(message, error);
    }
  }
);
