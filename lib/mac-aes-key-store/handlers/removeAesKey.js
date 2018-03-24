'use strict';

const { Reader: reader } = require('monet');

module.exports = ({ deviceId }, message) => reader(
  ({ macAesKeyStore, messageHub }) => macAesKeyStore.remove(deviceId)
    .catch(messageHub.logError(message))
);
