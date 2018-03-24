'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {string} deviceId
 * @param {Message} message
 * @return {Reader.<removeDeviceConfigBackups>}
 */
module.exports = ({ deviceId }, message) => reader(
  /**
   * @function removeDeviceConfigBackups
   * @param {MessageHub} messageHub
   * @param {backups} backups
   * @return {Promise}
   */
  ({ messageHub, backups }) => backups.removeDeviceConfigBackupsByDeviceId(deviceId)
    .catch(messageHub.logError(message))
);

