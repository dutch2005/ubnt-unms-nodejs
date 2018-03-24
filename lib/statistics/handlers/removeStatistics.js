'use strict';

const { Reader: reader } = require('monet');

module.exports = ({ deviceId }, message) => reader(
  ({ statistics, messageHub }) => statistics.deleteDeviceStatistics(deviceId)
    .catch(messageHub.logError(message))
);
