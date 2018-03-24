'use strict';

const { Reader: reader } = require('monet');

// eslint-disable-next-line valid-jsdoc
/**
 * @param {CorrespondenceDevice} device
 * @param {CorrespondenceUser} user
 * @param {Message} message
 * @return {Reader.<onDeviceRestartedHandler~callback>}
 */
module.exports = ({ device, user }, message) => reader(
  // TODO(karel.kristal@unms.com): check cmUser availability if onDeviceRestart is emitted without a user
  ({ eventLog, messageHub }) => eventLog.logDeviceRestartedEvent(device, user)
    .catch(messageHub.logError(message))
);
