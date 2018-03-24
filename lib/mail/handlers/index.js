'use strict';

const { weave } = require('ramda-adjunct');

const sendUserRevokedEmail = require('./sendUserRevokedEmail');
const sendUserInvitedEmail = require('./sendUserInvitedEmail');
const sendUserUpdatedEmail = require('./sendUserUpdatedEmail');
const sendUserPasswordResetRequestedEmail = require('./sendUserPasswordResetRequestedEmail');

exports.register = (server, messageHub, messages) => {
  const { DB, mail } = server.plugins;

  const sendUserRevokedEmailBound = weave(sendUserRevokedEmail, { DB, messageHub, mail });
  const sendUserInvitedEmailBound = weave(sendUserInvitedEmail, { DB, messageHub, mail });
  const sendUserUpdatedEmailBound = weave(sendUserUpdatedEmail, { DB, messageHub, mail });
  const sendUserPasswordResetRequestedEmailBound = weave(sendUserPasswordResetRequestedEmail, { DB, messageHub, mail });

  const { userRemoved, userCreated, userUpdated, userPasswordResetRequested } = messages;
  messageHub.subscribe(userRemoved, sendUserRevokedEmailBound);
  messageHub.subscribe(userCreated, sendUserInvitedEmailBound);
  messageHub.subscribe(userUpdated, sendUserUpdatedEmailBound);
  messageHub.subscribe(userPasswordResetRequested, sendUserPasswordResetRequestedEmailBound);
};
