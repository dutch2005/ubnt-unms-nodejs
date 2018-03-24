'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {string} deviceId
 * @param {Message} message
 * @return {Reader.<onDeviceRemoveHandler~callback>}
 */
module.exports = ({ deviceId }, message) => reader(
  ({ outages, messageHub, dal }) => outages.stopOutageOnDeviceRemoved(Date.now(), deviceId)
    .then(() => dal.outageRepository.removeByDeviceId(deviceId))
    .catch(messageHub.logError(message))
);

