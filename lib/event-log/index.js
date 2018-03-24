'use strict';

const aguid = require('aguid');
const { Reader: reader } = require('monet');
const { assoc, when, pathEq, isEmpty, propEq } = require('ramda');
const { cata, isNotNull, isNotEmpty } = require('ramda-adjunct');
const {
  find, getOr, get, curry, omit, flow, partialRight, template, spread, partial, toUpper, stubObject, isNull, defaultTo,
  negate,
} = require('lodash/fp');
const moment = require('moment-timezone');
const { execFile } = require('child-process-promise');

const { isNotUndefined, resolveP, rejectP, allP } = require('../util');
const logging = require('../logging');
const { logRepository, logModel } = require('../dal');
const { DB } = require('../db');
const config = require('../../config');
const { LogTypeEnum, LogLevelEnum, TaskTypeEnum, DeviceTypeEnum } = require('../enums');
const { fromDb: fromDbDevice } = require('../transformers/device');
const { fromDb: fromDbDeviceMetadata } = require('../transformers/device/metadata');
const { toApiUser } = require('../transformers/user');

/*
 * Decorators
 */

const decorateWithDevice = curry((deviceIdentification, entry) =>
  assoc('device', omit(['site'], deviceIdentification), entry));

const decorateWithSite = curry((deviceIdentification, entry) => {
  if (isNotNull(deviceIdentification.site)) { return assoc('site', deviceIdentification.site, entry) }
  if (isNotNull(deviceIdentification.siteId)) { return assoc('site', { id: deviceIdentification.siteId }, entry) }
  return entry;
});

const decorateWithUser = assoc('user');

const decorateWithToken = assoc('token');

const decorateWithRemoteAddress = assoc('remoteAddress');

const decorateWithTags = assoc('tags');

/*
 * Business logic
 */

const isNotDeviceDeleteEvent = negate(propEq('type', LogTypeEnum.DeviceDelete));

const getDeviceDisplayName = (dbDevice, dbDeviceMetadata) => flow(
  get(['alias']),
  defaultTo(getOr('Unknown', ['identification', 'name'], dbDevice))
)(dbDeviceMetadata);

const saveEntry = entry => logRepository.save(logModel.build(entry))
  .catch(err => logging.error({ entry, message: 'Failed to log event.' }, err));

const createLogEntry = (message, level, type, timestamp) => ({
  message,
  level,
  type,
  id: aguid(),
  timestamp,
});

const logEvent = curry((message, level, type, timestamp) => flow(
  createLogEntry,
  saveEntry
)(message, level, type, timestamp));

/*
 * User events
 */

// eslint-disable-next-line no-unused-vars
const logLoginEvent = curry((remoteAddress, timestamp, user, token) => flow(
  createLogEntry,
  decorateWithUser(user),
  decorateWithToken(null), // remove -> security FTW!
  decorateWithRemoteAddress(remoteAddress),
  decorateWithTags(['login']),
  saveEntry
)(`USER: ${user.username} log in from ${remoteAddress}`, LogLevelEnum.Info, LogTypeEnum.UserLogin, timestamp));

const logLoginEventTwoAuth = curry(
  (remoteAddress, timestamp, twoFactorToken, token, user) => logLoginEvent(remoteAddress, timestamp, user, token)
);

const logFailedLoginEvent = (username, remoteAddress, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithRemoteAddress(remoteAddress),
  decorateWithTags(['login', 'failure']),
  saveEntry
)(`USER: '${username.substr(0, 3)}...' failed to log in to UNMS from ${remoteAddress}`,
  LogLevelEnum.Warning, LogTypeEnum.UserLoginFail, timestamp);


const logSendingEmailNotificationFailure = (timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['event-notification', 'failure']),
  saveEntry
)('Failed to email events notification most probably due to Gmail credentials.',
  LogLevelEnum.Warning, LogTypeEnum.EventNotificationFail, timestamp);

const logUserRemovedSendingEmailFailed = (user, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['email-dispatch', 'failure']),
  decorateWithUser(user),
  saveEntry
)(`Failed to send revoke email to user: ${user.username}.`,
  LogLevelEnum.Error, LogTypeEnum.EmailDispatchFail, timestamp);

const logUserInvitedSendingEmailFailed = (user, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['email-dispatch', 'failure']),
  decorateWithUser(user),
  saveEntry
)(`Failed to send invitation email to user: ${user.username}.`,
  LogLevelEnum.Error, LogTypeEnum.EmailDispatchFail, timestamp);

const logUserUpdatedSendingEmailFailed = (user, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['email-dispatch', 'failure']),
  decorateWithUser(user),
  saveEntry
)(`Failed to send email-address-change email to user: ${user.username}.`,
  LogLevelEnum.Error, LogTypeEnum.EmailDispatchFail, timestamp);


  /*
 * System events
 */

const logNmsUpdateStarted = curry((oldVersion, newVersion, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['nms-update']),
  saveEntry
)(`Started UNMS upgrade from version ${oldVersion} to ${newVersion}`,
  LogLevelEnum.Info, LogTypeEnum.Other, timestamp));

const logNmsUpdateSuccessful = curry((oldVersion, newVersion, currentVersion, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['nms-update']),
  saveEntry
)(`UNMS upgrade from version ${oldVersion} to ${newVersion} finished successfully`,
  LogLevelEnum.Info, LogTypeEnum.Other, timestamp));

const logNmsUpdateUnknown = curry((oldVersion, newVersion, currentVersion, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['nms-update']),
  saveEntry
)(`UNMS upgrade from version ${oldVersion} to ${newVersion} finished with an unknown result. \
Current version is ${currentVersion}`,
  LogLevelEnum.Warning, LogTypeEnum.Other, timestamp));

const logNmsUpdateFailed = curry((oldVersion, newVersion, currentVersion, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['nms-update']),
  saveEntry
)(`UNMS upgrade from version ${oldVersion} to ${newVersion} failed. Current version is ${currentVersion}`,
  LogLevelEnum.Error, LogTypeEnum.Other, timestamp));

const logFluentdPingFailed = curry((host, port, timestamp = Date.now()) => flow(
  createLogEntry,
  decorateWithTags(['service-unavailable']),
  saveEntry
)(`The logging container ${host} is not responding. Please check Docker logs for related error messages.`,
  LogLevelEnum.Error, LogTypeEnum.Other, timestamp));

const logSslCertError = curry((timestamp = Date.now()) => flow(
    createLogEntry,
    decorateWithTags(['ssl-cert']),
    saveEntry
  )('SSL certificate renewal failed. Please check Settings/UNMS and the nginx.*.log file for error messages.',
  LogLevelEnum.Error, LogTypeEnum.Other, timestamp));

/*
 * Device events
 */

const createDeviceLogMessage = (logType, dbDevice, dbDeviceMetadata) => {
  const typeUpper = toUpper(dbDevice.identification.type);
  const name = getDeviceDisplayName(dbDevice, dbDeviceMetadata);

  switch (logType) {
    case LogTypeEnum.DeviceAuthorize:
      return `${typeUpper}: ${name} was authorized.`;

    case LogTypeEnum.DeviceDelete: {
      const ip = defaultTo('', get(['identification', 'ipAddress'], dbDevice));
      const mac = defaultTo('', get(['identification', 'mac'], dbDevice));
      const addresses = [
        `${isEmpty(ip) ? '' : `IP: ${ip}`}`,
        `${isEmpty(mac) ? '' : `MAC: ${mac}`}`,
      ].filter(isNotEmpty).join(', ');

      return `${typeUpper}: ${name}${isEmpty(addresses) ? '' : ` (${addresses})`} was deleted.`;
    }

    case LogTypeEnum.DeviceBackupCreate:
      return `${typeUpper}: ${name} has a new backup configuration.`;

    case LogTypeEnum.DeviceBackupApply:
      return `${typeUpper}: backup configuration has been recovered for ${name}.`;

    case LogTypeEnum.DeviceAutomaticBackupCreate:
      return `${typeUpper}: ${name} has a new automatically created backup configuration.`;

    case LogTypeEnum.DeviceAppear:
      return pathEq(['identification', 'type'], DeviceTypeEnum.Onu, dbDevice)
        ? `${typeUpper}: ${name} was discovered and authorized.`
        : `${typeUpper}: ${name} was discovered and waiting for authorization.`;

    case LogTypeEnum.DeviceReappear:
      return `${typeUpper}: ${name} connected back to UNMS.`;

    case LogTypeEnum.OltGotUnsupportedOnu:
      return `${typeUpper}: unsupported onu(s) connected to ${name}.`;

    default:
      logging.error(`Unexpected action type: ${logType}.`);
      return '';
  }
};


const logDeviceEvent = curry((message, level, type, timestamp, deviceIdentification) => flow(
  createLogEntry,
  when(isNotDeviceDeleteEvent, decorateWithDevice(deviceIdentification)),
  decorateWithSite(deviceIdentification),
  decorateWithTags(['device']),
  saveEntry
)(message, level, type, timestamp));


const logDeviceEventByType = curry((logType, level, device, deviceMetaData) => flow(
  createDeviceLogMessage,
  partialRight(logDeviceEvent, [level, logType, Date.now(), device.identification])
)(logType, device, deviceMetaData));


const logDeviceEventByLevel = (logType, level, device) => reader(
  ({ dal }) => dal.deviceMetadataRepository.findById(device.identification.id)
    .then(logDeviceEventByType(logType, level, device))
);

const logDeviceInfoEvent = (logType, device) => reader(
  ({ dal }) => logDeviceEventByLevel(logType, LogLevelEnum.Info, device).run({ dal })
);

const logDeviceWarningEvent = (logType, device) => reader(
  ({ dal }) => logDeviceEventByLevel(logType, LogLevelEnum.Warning, device).run({ dal })
);

const logDeviceMovedEvent = (cmDevice, dbSite, dbUser) => {
  const deviceType = cmDevice.identification.type.toUpperCase();
  const deviceName = getDeviceDisplayName(cmDevice, cmDevice.meta);
  const message = `${deviceType}: ${deviceName} was moved to ${dbSite.identification.name} by ${dbUser.username}.`;

  return logDeviceEvent(message, LogLevelEnum.Info, LogTypeEnum.DeviceMove, Date.now(), cmDevice.identification);
};

const logDeviceAuthorizedEvent = (cmDevice, dbUser) => {
  const deviceType = cmDevice.identification.type.toUpperCase();
  const deviceName = getDeviceDisplayName(cmDevice, cmDevice.meta);
  const message = `${deviceType}: ${deviceName} was authorized by ${dbUser.username}.`;

  return logDeviceEvent(message, LogLevelEnum.Info, LogTypeEnum.DeviceAuthorize, Date.now(), cmDevice.identification);
};

const logDeviceRestartedEvent = (cmDevice, cmUser) => {
  const deviceType = cmDevice.identification.type.toUpperCase();
  const deviceName = getDeviceDisplayName(cmDevice, cmDevice.meta);
  const message = `${deviceType}: ${deviceName} was restarted by ${cmUser.username}.`;
  return logDeviceEvent(message, LogLevelEnum.Info, LogTypeEnum.DeviceRestart, Date.now(), cmDevice.identification);
};

const logDeviceUpgradeStatusEvent = (
  dbDevice,
  dbDeviceMetadata,
  firmware,
  logType,
  { username = null, error = null } = {}
) => {
  const deviceType = dbDevice.identification.type.toUpperCase();
  const deviceName = getDeviceDisplayName(dbDevice, dbDeviceMetadata);
  const deviceFirmwareVersion = dbDevice.identification.firmwareVersion;
  const firmwareVersion = firmware.identification.version;

  let level = LogLevelEnum.Info;
  let message = `${deviceType}: ${deviceName} upgrade from firmware version ${deviceFirmwareVersion} to ` +
    `firmware version ${firmwareVersion}`;

  switch (logType) {
    case LogTypeEnum.DeviceUpgradeStart:
      message = isNull(username) ? `${message} started.` : `${message} started by ${username}.`;
      break;
    case LogTypeEnum.DeviceUpgradeSuccess:
      message = `${message} was successful.`;
      break;
    case LogTypeEnum.DeviceUpgradeFailed:
      level = LogLevelEnum.Error;
      message = isNull(error) ? `${message} has failed.` : `${message} has failed because of error (${error}).`;
      break;
    case LogTypeEnum.DeviceUpgradeCancel:
      message = isNull(username) ? `${message} was canceled.` : `${message} was canceled by ${username}.`;
      break;
    default:
      throw new Error('Unknown DeviceUpgrade log type');
  }

  return logDeviceEvent(message, level, logType, Date.now(), dbDevice.identification);
};

const logDeviceConnectionFail = (deviceId, remoteAddress, level, logType, time) => reader(
  ({ dal }) => {
    const findLoggedConnectionFailure = logRepository.findOne({ where: {
      device: { id: deviceId },
      type: logType,
      timestamp: { $gt: moment(Date.now() - config.connectionLogEventInterval) },
    } });

    const logDeviceConnectionError = () => {
      const cmDeviceP = DB.device.findById(deviceId)
        .then(fromDbDevice({}))
        .then(cata(rejectP, resolveP));
      const cmDeviceMetadataP = dal.deviceMetadataRepository.findById(deviceId)
        .then(fromDbDeviceMetadata({}))
        .then(cata(rejectP, resolveP));
      return allP([cmDeviceP, cmDeviceMetadataP])
        .then(([cmDevice, cmDeviceMetadata]) => {
          const deviceType = cmDevice.identification.type.toUpperCase();
          const deviceName = getDeviceDisplayName(cmDevice, cmDeviceMetadata);
          const message =
            `${deviceType}: ${deviceName} connection failed.
              Try using the Refresh button or check the UNMS Key on the device.`;
          return logDeviceEvent(message, level, logType, time, cmDevice.identification);
        })
        .catch(() => {
          const message =
            `Problem with establishing connection from ${remoteAddress}. Check the UNMS Key on the device.`;
          return logDeviceEvent(message, level, logType, time, { id: deviceId, remoteAddress });
        });
    };

    return findLoggedConnectionFailure
      .then(when(isEmpty, logDeviceConnectionError));
  }
);


/**
 * @name EventLog~logTaskStart
 * @param {DbTask} dbTask
 * @param {DbDeviceMetadata} dbDeviceMetadata
 * @return {Promise.<*>}
 */
const logTaskStart = (dbTask, dbDeviceMetadata) => reader(
  ({ user }) => {
    switch (dbTask.type) {
      case TaskTypeEnum.FirmwareUpgrade: {
        const { device, firmware } = dbTask.payload;
        return user.getUser(dbTask.userId)
          .promise()
          .catch(stubObject)
          .then(({ username }) => logDeviceUpgradeStatusEvent(
            device, dbDeviceMetadata, firmware, LogTypeEnum.DeviceUpgradeStart, { username }
          ));
      }
      default:
        return resolveP();
    }
  }
);

/**
 * @name EventLog~logTaskComplete
 * @param {DbTask} dbTask
 * @param {DbDeviceMetadata} dbDeviceMetadata
 * @return {Promise.<*>}
 */
const logTaskComplete = (dbTask, dbDeviceMetadata) => {
  switch (dbTask.type) {
    case TaskTypeEnum.FirmwareUpgrade: {
      const { device, firmware } = dbTask.payload;
      return logDeviceUpgradeStatusEvent(device, dbDeviceMetadata, firmware, LogTypeEnum.DeviceUpgradeSuccess);
    }
    default:
      return resolveP();
  }
};

/**
 * @name EventLog~logTaskFail
 * @param {DbTask} dbTask
 * @param {DbDeviceMetadata} dbDeviceMetadata
 * @return {Promise.<*>}
 */
const logTaskFail = (dbTask, dbDeviceMetadata) => {
  switch (dbTask.type) {
    case TaskTypeEnum.FirmwareUpgrade: {
      const { device, firmware } = dbTask.payload;
      return logDeviceUpgradeStatusEvent(
        device, dbDeviceMetadata, firmware, LogTypeEnum.DeviceUpgradeFailed, { error: dbTask.error }
      );
    }
    default:
      return resolveP();
  }
};

/**
 * @name EventLog~logTaskCancel
 * @param {DbTask} dbTask
 * @param {DbDeviceMetadata} dbDeviceMetadata
 * @param {?string} [userId]
 * @return {Promise.<*>}
 */
const logTaskCancel = (dbTask, dbDeviceMetadata, userId = null) => reader(
  ({ user }) => {
    switch (dbTask.type) {
      case TaskTypeEnum.FirmwareUpgrade: {
        const { device, firmware } = dbTask.payload;

        if (isNull(userId)) {
          return logDeviceUpgradeStatusEvent(device, dbDeviceMetadata, firmware, LogTypeEnum.DeviceUpgradeCancel);
        }

        return user.getUser(userId)
          .promise()
          .catch(stubObject)
          .then(dbUser =>
            logDeviceUpgradeStatusEvent(device, dbDeviceMetadata, firmware, LogTypeEnum.DeviceUpgradeCancel, {
              username: dbUser.username,
            })
          );
      }
      default:
        return resolveP();
    }
  }
);


/*
 * Device interface events
 */

const logInterfaceStatusChanged = (messageTemplate, { userId, deviceId } = {}, interfaceName) => reader(
  ({ user, dal }) => {
    const getUserP = uid => user.getUser(uid).chainEither(toApiUser).promise();

    const dbUserP = resolveP(userId).then(when(isNotUndefined, getUserP));
    const dbDeviceP = resolveP(deviceId).then(when(isNotUndefined, DB.device.findById));
    const dbDeviceIdentificationP = dbDeviceP.then(getOr(null, 'identification'));
    const dbDeviceMetadataP = dal.deviceMetadataRepository.findById(deviceId);
    const level = LogLevelEnum.Info;
    const type = LogTypeEnum.Other;
    const currentTimestamp = Date.now();
    const dbInterfaceP = dbDeviceP
      .then(get('interfaces'))
      .then(find(pathEq(['identification', 'name'], interfaceName)));
    const messagePromise = allP([dbUserP, dbDeviceP, dbInterfaceP, dbDeviceMetadataP])
      .then(([dbUser, dbDevice, dbInterface, dbDeviceMetadata]) => messageTemplate({
        deviceType: flow(getOr('Unknown', ['identification', 'type']), toUpper)(dbDevice),
        deviceName: defaultTo('Unknown', getDeviceDisplayName(dbDevice, dbDeviceMetadata)),
        interfaceName: getOr('Unknown', ['identification', 'description'], dbInterface),
        username: getOr('Unknown', 'username', dbUser),
      }));

    return allP([messagePromise, level, type, currentTimestamp, dbDeviceIdentificationP])
      .then(spread(logDeviceEvent));
  }
);

const logInterfaceBlocked = partial(logInterfaceStatusChanged, [template(
  '<%= deviceType %>: <%= deviceName %>, interface: <%= interfaceName %> has been blocked by <%= username %>'
)]);

const logInterfaceUnblocked = partial(logInterfaceStatusChanged, [template(
  '<%= deviceType %>: <%= deviceName %>, interface: <%= interfaceName %> has been unblocked by <%= username %>'
)]);

const logInterfaceConnected = partial(logInterfaceStatusChanged, [template(
  '<%= deviceType %>: <%= deviceName %>, interface: <%= interfaceName %> has been connected'
)]);

const logInterfaceDisconnected = partial(logInterfaceStatusChanged, [template(
  '<%= deviceType %>: <%= deviceName %>, interface: <%= interfaceName %> has been disconnected'
)]);


/*
 * Scheduled cleaner
 */
const cleanOldLogs = (time = Date.now()) => logRepository.removeOld(time - config.eventLog.maxAge)
  .catch(error => logging.error('Failed to remove old logs.', error));


/*
 * Periodically check if fluentd is running and logs a message if not
 */
const pingFluentd = () =>
  execFile('sh', ['-c', `nc -z ${config.fluentdHost} ${config.fluentdPort}`])
    .catch((error) => {
      logging.error(`Unable to reach ${config.fluentdHost}:${config.fluentdPort}`, error);
      logFluentdPingFailed(config.fluentdHost, config.fluentdPort);
    });

/**
 * @alias EventLog
 */
module.exports = {
  cleanOldLogs,
  pingFluentd,
  logDeviceAuthorizedEvent,
  logDeviceEvent,
  logDeviceInfoEvent,
  logDeviceWarningEvent,
  logDeviceMovedEvent,
  logDeviceRestartedEvent,
  logDeviceConnectionFail,
  logTaskStart,
  logTaskComplete,
  logTaskFail,
  logTaskCancel,
  logEvent,
  logFailedLoginEvent,
  logInterfaceBlocked,
  logInterfaceConnected,
  logInterfaceDisconnected,
  logInterfaceUnblocked,
  logLoginEvent,
  logLoginEventTwoAuth,
  logSendingEmailNotificationFailure,
  logNmsUpdateStarted,
  logNmsUpdateSuccessful,
  logNmsUpdateUnknown,
  logNmsUpdateFailed,
  logSslCertError,
  logUserRemovedSendingEmailFailed,
  logUserInvitedSendingEmailFailed,
  logUserUpdatedSendingEmailFailed,
};
