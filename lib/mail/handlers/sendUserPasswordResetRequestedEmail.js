'use strict';

const { Reader: reader } = require('monet');

const { getUnmsHostname } = require('../../util');

//  (Payload, Message) -> Reader -> Promise
//    Payload = {user: Object, passwordToken: Object}
module.exports = ({ user, passwordToken }, message) => reader(
  /**
   * @function sendUserPasswordResetRequestedEmail
   * @param {DB} DB
   * @param {MessageHub} messageHub
   * @param {mail} mail
   * @return {Promise}
   */
  ({ DB, messageHub, mail }) => DB.nms.get()
    .then((nms) => {
      const sender = mail.configureAndSendForgottenPasswordResetLink(nms.smtp);
      const mailData = { to: user.email };
      const context = {
        adminName: user.username,
        unmsHostname: getUnmsHostname(nms),
        passwordToken: passwordToken.id,
      };

      return sender(mailData, context);
    })
    .catch(messageHub.logError(message))
);
