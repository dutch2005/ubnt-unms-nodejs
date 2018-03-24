'use strict';

const { Reader: reader } = require('monet');

const { getUnmsHostname } = require('../../util');

/**
 * @param {CorrenspondenceUser} user
 * @param {Message} message
 * @return {Reader.<sendUserRevokedEmail>}
 */
module.exports = ({ user }, message) => reader(
  /**
   * @function sendUserRevokedEmail
   * @param {DB} DB
   * @param {MessageHub} messageHub
   * @param {mail} mail
   * @return {Promise}
   */
  ({ DB, messageHub, mail }) => DB.nms.get()
    .then((nms) => {
      const sender = mail.configureAndSendAdminRevoke(nms.smtp);
      const mailData = { to: user.email };
      const context = { adminName: user.username, unmsHostname: getUnmsHostname(nms) };

      return sender(mailData, context);
    })
    .catch((error) => {
      messageHub.publish(messageHub.messages.userRemovedEmailSendingFailed(user));
      messageHub.logError(message, error);
    })
);

