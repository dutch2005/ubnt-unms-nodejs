'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const { toMs } = require('../util');
const eventLog = require('./index');
const handlers = require('./handlers');
const { sendEventNotification } = require('./event-notification');

/*
 * Hapi plugin definition
 */
function register(server) {
  const config = server.settings.app;
  const { messageHub, user, settings, mail, scheduler, dal } = server.plugins;

  const service = {
    sendEventNotification: weave(sendEventNotification, { user, settings, mail }),
    logNmsUpdateStarted: eventLog.logNmsUpdateStarted,
    logNmsUpdateSuccessful: eventLog.logNmsUpdateSuccessful,
    logNmsUpdateFailed: eventLog.logNmsUpdateFailed,
    logNmsUpdateUnknown: eventLog.logNmsUpdateUnknown,
    logSslCertError: eventLog.logSslCertError,
    logSendingRevokeUserEmailFailure: eventLog.logSendingRevokeUserEmailFailure,
    logSendingInviteUserEmailFailure: eventLog.logSendingInviteUserEmailFailure,
    logSendingUpdateUserEmailFailure: eventLog.logSendingUpdateUserEmailFailure,

    logTaskStart: weave(eventLog.logTaskStart, { user }),
    logTaskCancel: weave(eventLog.logTaskCancel, { user }),
    logInterfaceBlocked: weave(eventLog.logInterfaceBlocked, { user, dal }),
    logInterfaceUnblocked: weave(eventLog.logInterfaceUnblocked, { user, dal }),
    logInterfaceConnected: weave(eventLog.logInterfaceConnected, { user, dal }),
    logInterfaceDisconnected: weave(eventLog.logInterfaceDisconnected, { user, dal }),
    logDeviceConnectionFail: weave(eventLog.logDeviceConnectionFail, { dal }),
    logDeviceInfoEvent: weave(eventLog.logDeviceInfoEvent, { dal }),
    logDeviceWarningEvent: weave(eventLog.logDeviceWarningEvent, { dal }),

    cleanOldLogs: eventLog.cleanOldLogs,
    pingFluentd: eventLog.pingFluentd,
    logDeviceAuthorizedEvent: eventLog.logDeviceAuthorizedEvent,
    logDeviceEvent: eventLog.logDeviceEvent,
    logDeviceMovedEvent: eventLog.logDeviceMovedEvent,
    logDeviceRestartedEvent: eventLog.logDeviceRestartedEvent,
    logTaskComplete: eventLog.logTaskComplete,
    logTaskFail: eventLog.logTaskFail,
    logEvent: eventLog.logEvent,
    logFailedLoginEvent: eventLog.logFailedLoginEvent,
    logLoginEvent: eventLog.logLoginEvent,
    logLoginEventTwoAuth: eventLog.logLoginEventTwoAuth,
    logSendingEmailNotificationFailure: eventLog.logSendingEmailNotificationFailure,
    logUserRemovedSendingEmailFailed: eventLog.logUserRemovedSendingEmailFailed,
    logUserInvitedSendingEmailFailed: eventLog.logUserInvitedSendingEmailFailed,
    logUserUpdatedSendingEmailFailed: eventLog.logUserUpdatedSendingEmailFailed,
  };

  // schedule periodic tasks
  if (!config.demo) {
    scheduler.registerDailyTask(service.cleanOldLogs, 'cleanOldLogs');
    scheduler.registerDailyTask(service.pingFluentd, 'pingFluentd');
    scheduler.registerPeriodicTask(service.sendEventNotification, toMs('minute', 1), 'sendEventNotification');
  }

  server.expose(service);
  messageHub.registerHandlers(handlers);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'eventLog',
  version: '1.0.0',
  dependencies: ['messageHub', 'settings', 'logging', 'mail', 'user', 'scheduler'],
};
