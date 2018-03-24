'use strict';

const { weave } = require('ramda-adjunct');

const logDeviceRemoved = require('./logDeviceRemoved');
const logDecryptionFailed = require('./logDecryptionFailed');
const logDeviceRestarted = require('./logDeviceRestarted');
const logUserInvitedEmailSendingFailed = require('./logUserInvitedEmailSendingFailed');
const logUserUpdatedEmailSendingFailed = require('./logUserUpdatedEmailSendingFailed');
const logUserRemovedEmailSendingFailed = require('./logUserRemovedEmailSendingFailed');
const deviceRemoved = require('./deviceRemoved');
const logOltGotUnsupportedOnu = require('./logOltGotUnsupportedOnu');


exports.register = (server, messageHub, messages) => {
  const { dal, eventLog } = server.plugins;

  const logDeviceRemovedBound = weave(logDeviceRemoved, { eventLog, messageHub });
  const logDecryptionFailedBound = weave(logDecryptionFailed, { eventLog, messageHub });
  const logDeviceRestartedBound = weave(logDeviceRestarted, { eventLog, messageHub });
  const logUserInvitedEmailSendingFailedBound = weave(logUserInvitedEmailSendingFailed, { eventLog, messageHub });
  const logUserUpdatedEmailSendingFailedBound = weave(logUserUpdatedEmailSendingFailed, { eventLog, messageHub });
  const logUserRemovedEmailSendingFailedBound = weave(logUserRemovedEmailSendingFailed, { eventLog, messageHub });
  const deviceRemovedBound = weave(deviceRemoved, { messageHub, dal });
  const logOltGotUnsupportedOnuBound = weave(logOltGotUnsupportedOnu, { eventLog, messageHub });

  messageHub.subscribe(messages.deviceRemoved, logDeviceRemovedBound);
  messageHub.subscribe(messages.deviceConnectionFailure, logDecryptionFailedBound);
  messageHub.subscribe(messages.deviceRestarted, logDeviceRestartedBound);
  messageHub.subscribe(messages.userInvitedEmailSendingFailed, logUserInvitedEmailSendingFailedBound);
  messageHub.subscribe(messages.userRemovedEmailSendingFailed, logUserUpdatedEmailSendingFailedBound);
  messageHub.subscribe(messages.userUpdatedEmailSendingFailed, logUserRemovedEmailSendingFailedBound);
  messageHub.subscribe(messages.deviceRemoved, deviceRemovedBound);
  messageHub.subscribe(messages.oltGotUnsupportedOnuEvent, logOltGotUnsupportedOnuBound);
};
