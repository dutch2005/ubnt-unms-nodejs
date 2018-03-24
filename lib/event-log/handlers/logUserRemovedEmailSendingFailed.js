'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {CorrespondenceUser} user
 * @param {Message} message
 * @return {Reader.<userRemovedEmailSendingFailed~callback>}
 */
module.exports = ({ user }, message) => reader(
  ({ eventLog, messageHub }) => eventLog.logUserRemovedSendingEmailFailed(user)
    .catch(messageHub.logError(message))
);
