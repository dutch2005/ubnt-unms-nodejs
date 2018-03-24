'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {string} deviceId
 * @param {Message} message
 * @return {Reader.<onDeviceRemovedHandler~callback>}
 */
module.exports = ({ deviceId }, message) => reader(
  /**
   * @function onDeviceRemovedHandler
   * @param {MessageHub} messageHub
   * @param {Dal} dal
   * @return {Promise}
   */
  ({ messageHub, dal }) => dal.logRepository.removeByDeviceId(deviceId)
    .catch(messageHub.logError(message))
);
