'use strict';

const { Reader: reader } = require('monet');

/**
 * @param {CorrespondenceUser} user
 * @param {Message} message
 * @return {Reader.<userInvitedEmailSendingFailed~callback>}
 */
module.exports = ({ user }, message) => reader(
  ({ eventLog, messageHub }) => eventLog.logUserInvitedSendingEmailFailed(user)
    .catch(messageHub.logError(message))
);
