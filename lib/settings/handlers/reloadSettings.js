'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {*} _
 * @param {Message} message
 * @return {Reader.<onSettingsChangedHandler~callback>}
 */
module.exports = (_, message) => reader(
  ({ settings, messageHub }) => settings.loadSettings()
    .catch(messageHub.logError(message))
);
