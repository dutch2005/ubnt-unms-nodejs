'use strict';

const { flow, spread, partial, includes, values } = require('lodash');
const { getOr, get, map, orderBy, slice, overSome, constant, isNull } = require('lodash/fp');
const { pathEq, assocPath, assoc, when, pipeP, curry } = require('ramda');
const { weave } = require('ramda-adjunct');
const moment = require('moment-timezone');
const { Reader: reader } = require('monet');

const config = require('../../config');
const { DB } = require('../db');
const { log } = require('../logging');
const { tapP } = require('../util');
const { isSmtpAuthError } = require('../util/smtp');
const { logRepository } = require('../dal');
const { logSendingEmailNotificationFailure } = require('./index');
const { toApiUsers } = require('../transformers/user');

const getCustomReceivers = (userIds, users) => users.filter(flow(get('id'), partial(includes, userIds)));

const isOlderThan = curry((duration, time) => moment().subtract(duration).isAfter(time));

const canLogSendingEmailNotificationFailure = overSome([
  isNull,
  isOlderThan(config.eventLog.mailNotification.failedLogPeriod),
]);

const logSmtpAuthError = nmsPromise => nmsPromise
  .then(getOr(null, 'latestFailedEmailLog'))
  .then(when(
    canLogSendingEmailNotificationFailure,
    pipeP(
      logSendingEmailNotificationFailure,
      constant(nmsPromise),
      assoc('latestFailedEmailLog', Date.now()),
      DB.nms.update
    )
  ));

const createReceiverGroupsReducer = (systemReceivers, users) => (accumulator, site) => {
  const { type, users: userIds } = site.notifications;
  const customReceivers = getCustomReceivers(userIds, users);
  switch (type) {
    case 'none':
      return assocPath([site.id], [], accumulator);
    case 'system':
      return assocPath([site.id], systemReceivers, accumulator);
    case 'custom':
      return assocPath([site.id], customReceivers, accumulator);
    default:
      log('error', { site, message: 'Unexpected notifications.type value' });
      return assocPath([site.id], [], accumulator);
  }
};

const groupReceiversBySite = (sites, allUsers) => {
  const systemReceivers = allUsers.filter(pathEq(['alerts'], true));
  const reducer = createReceiverGroupsReducer(systemReceivers, allUsers);

  return sites.reduce(reducer, { default: systemReceivers });
};

const createGroupLogsReducer = receivers => (accumulator, logItem) => {
  const newAccumulator = Object.assign({}, accumulator);
  const siteId = get(['site', 'id'], logItem);
  const logReceivers = getOr(receivers.default, [siteId], receivers);

  logReceivers.forEach((user) => {
    if (newAccumulator[user.id] === undefined) {
      newAccumulator[user.id] = { user, logs: [] };
    }
    newAccumulator[user.id].logs.push(logItem);
  });
  return newAccumulator;
};

const groupLogsByUser = (logs, receivers) => values(logs.reduce(createGroupLogsReducer(receivers), {}));

const markLogAsSendByEmail = curry((receivers, logItem) => {
  const siteId = get(['site', 'id'], logItem);
  const logReceivers = getOr(receivers.default, [siteId], receivers);
  const logReceiverEmails = logReceivers.map(get('email'));

  return logItem
    .map(assoc('mailNotificationTimestamp', Date.now()))
    .map(assoc('mailNotificationEmails', logReceiverEmails));
});

const markLogsAsSentByEmail = (logs, receivers) => logs.map(markLogAsSendByEmail(receivers));

const sendEmail = (sender, name, to, message, unmsLink, timezone = 'UTC') => {
  const emailDateTime = moment().tz(timezone).format('LL LT');
  const mailData = { to };
  const context = { name, message, unmsLink, emailDateTime };
  return sender(mailData, context);
};

const sliceLogs = flow(
  orderBy('timestamp', 'desc'),
  slice(0, config.eventLog.mailNotification.maxItems)
);

const logsToString = (logs, timezone = 'UTC') => logs.reduce((accumulator, logItem) =>
  `${accumulator}${logItem.message} (${moment(logItem.timestamp).tz(timezone).format('LL LT')})\n`, '');

const createMailMessage = (logs, timezone) => flow(
  sliceLogs,
  (visibleLogs) => {
    const message = logsToString(visibleLogs, timezone);
    return logs.length > visibleLogs.length
      ? `${message}\n\nTotal amount of recent events: ${logs.length}\n\n`
      : message;
  }
)(logs);

const createAndSendEmails = curry((unmsGuiUrl, groupedLogs, nms) => reader(
  ({ mail }) => {
    const sender = mail.configureAndSendEventNotification(nms.smtp);
    return Promise.all(groupedLogs.map((item) => {
      const { logs, user: { username, email } } = item;

      if (logs.length === 0) { return null }
      const message = createMailMessage(logs, nms.timezone);
      return sendEmail(sender, username, email, message, unmsGuiUrl, nms.timezone);
    }));
  }
));

const sendEventNotification = () => reader(
  ({ settings, mail, user }) => {
    const unmsGuiUrl = settings.unmsGuiUrl();
    const emailSender = weave(createAndSendEmails, { mail })(unmsGuiUrl);
    const noLogsMessage = 'No logs to process';
    const { level, type } = config.eventLog.mailNotification;
    const where = {
      mail_notification_timestamp: null,
      $or: {
        level: { $in: level },
        type: { $in: type },
      },
    };

    const logsPromise = logRepository.findAll({ where })
      .then(tapP((logs) => {
        if (logs.length === 0) { throw noLogsMessage }
      }));

    const receiverGroupsPromise = logsPromise
      .then(() => Promise.all([
        DB.site.list(),
        user
          .getUsers()
          .chainEither(toApiUsers)
          .promise(),
      ]))
      .then(spread(groupReceiversBySite));

    const nmsPromise = DB.nms.get();

    return Promise.all([logsPromise, receiverGroupsPromise, nmsPromise])
      .then(spread(groupLogsByUser))
      .then(groupedLogs => Promise.all([groupedLogs, nmsPromise]))
      .then(spread(emailSender))
      .then(() => Promise.all([logsPromise, receiverGroupsPromise]))
      .then(spread(markLogsAsSentByEmail))
      .then(map(logRepository.update))
      .catch((error) => {
        if (error === noLogsMessage) {
          return;
        }
        if (isSmtpAuthError(error)) {
          logSmtpAuthError(nmsPromise);
        }
        log('error', { error, message: 'Failed to send notifications.' });
      });
  }
);

module.exports = {
  sendEventNotification,
};
