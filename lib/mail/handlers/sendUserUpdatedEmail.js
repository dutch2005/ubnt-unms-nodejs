'use strict';

const { Reader: reader } = require('monet');

const { getUnmsHostname, allP } = require('../../util');

//  (Payload, Message) -> Reader -> Promise
//    Payload = {pristineUser: Object, updatedUser: Object}
module.exports = ({ pristineUser, updatedUser }, message) => reader(
  /**
   * @function sendUserUpdatedEmail
   * @param {DB} DB
   * @param {MessageHub} messageHub
   * @param {mail} mail
   * @return {Promise}
   */
  ({ DB, messageHub, mail }) => DB.nms.get()
    .then((nms) => {
      if (pristineUser.email === updatedUser.email) { return false }

      const smtpSettings = nms.smtp;
      const oldEmailSender = mail.configureAndSendOldEmailNotification(smtpSettings);
      const newEmailSender = mail.configureAndSendNewEmailNotification(smtpSettings);
      const context = {
        adminName: pristineUser.username,
        unmsHostname: getUnmsHostname(nms),
      };

      return allP([
        oldEmailSender({ to: pristineUser.email }, context),
        newEmailSender({ to: updatedUser.email }, context),
      ]);
    })
    .catch((error) => {
      messageHub.publish(messageHub.messages.userUpdatedEmailSendingFailed(pristineUser));
      messageHub.logError(message, error);
    })
);
