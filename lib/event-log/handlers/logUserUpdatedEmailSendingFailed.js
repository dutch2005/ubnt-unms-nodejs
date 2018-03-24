'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {CorrespondenceUser} user
 * @param {Message} message
 * @return {Reader.<userUpdatedEmailSendingFailed~callback>}
 */
module.exports = ({ user }, message) => reader(
  ({ eventLog, messageHub }) => eventLog.logUserUpdatedSendingEmailFailed(user)
    .catch(messageHub.logError(message))
);
