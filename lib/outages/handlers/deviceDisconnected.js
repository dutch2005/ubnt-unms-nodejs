'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {CorrespondenceDevice} device
 * @param {Message} message
 * @return {Reader.<onDeviceDisconnectedHandler~callback>}
 */
module.exports = ({ device }, message) => reader(
  ({ outages, messageHub }) => {
    try {
      outages.deviceDisconnected(Date.now(), device);
    } catch (error) {
      messageHub.logError(message, error);
    }
  }
);
