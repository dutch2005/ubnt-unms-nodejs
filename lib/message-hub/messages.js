'use strict';

const { assign } = require('lodash/fp');

const { createMessage, routingKeyTag: key } = require('./utils');

/*
 * Message List
 *
 * Naming:
 * - use past tense if possible
 * - include ID or other identification if possible
 * - `key` template tag works as getOr on payload with keys
 *   e.g. key`device.${'deviceId'}.crashed` -> will replace ${'deviceId'} with getOr('unknown', 'deviceId', payload)
 */

// device related messages

// include deviceId to every payload
const deviceWithId = device => ({ deviceId: device.identification.id, device });

const deviceSaved = createMessage(
  key`device.${'deviceId'}.saved`,
  (device, isNew = false) => assign(deviceWithId(device), { isNew })
);
const deviceRemoved = createMessage(key`device.${'deviceId'}.removed`, deviceWithId);
const deviceRestarted = createMessage(
  key`device.${'deviceId'}.restarted`,
  (device, user = null) => assign(deviceWithId(device), { user })
);
const deviceRefreshed = createMessage(key`device.${'deviceId'}.refreshed`, deviceWithId);

const deviceDisconnected = createMessage(key`device.${'deviceId'}.disconnected`, deviceWithId);
const deviceConnected = createMessage(key`device.${'deviceId'}.connected`, deviceWithId);

const deviceConnectionSuccess = createMessage(key`device.${'deviceId'}.connection.success`, deviceId => ({ deviceId }));
const deviceConnectionFailure = createMessage(
  key`device.${'deviceId'}.connection.failure`,
  (deviceId, reason, ipAddress) => ({ deviceId, reason, ipAddress })
);

const deviceOutageStopped = createMessage(key`device.${'deviceId'}.outage.stopped`, deviceWithId);

// settings related events
const settingsChanged = createMessage('settings.changed');

// user related events
const userWithId = user => ({ userId: user.id, user });

const userWithPasswordToken = (user, passwordToken) => ({ user, passwordToken, userId: user.id });

const pristineAndUpdatedUser = (pristineUser, updatedUser) => ({
  pristineUser,
  updatedUser,
  userId: pristineUser.id,
});

const userRemoved = createMessage(key`user.${'userId'}.removed`, userWithId);

const userCreated = createMessage(key`user.${'userId'}.created`, userWithId);

const userUpdated = createMessage(key`user.${'userId'}.updated`, pristineAndUpdatedUser);

const userUpdatedEmailSendingFailed = createMessage(key`user.${'userId'}.updated.email.failed`, userWithId);

const userRemovedEmailSendingFailed = createMessage(key`user.${'userId'}.removed.email.failed`, userWithId);

const userInvitedEmailSendingFailed = createMessage(key`user.${'userId'}.invited.email.failed`, userWithId);

const userPasswordResetRequested = createMessage(key`user.${'userId'}.password.reset.requested`, userWithPasswordToken);

// socket
const messagePayload = (deviceId, message) => ({ deviceId, payload: message.data });
const emptyPayload = deviceId => ({ deviceId });
const deviceAsPayload = device => ({ deviceId: device.identification.id, payload: device });
const deviceIdAndPayload = (deviceId, payload) => ({ deviceId, payload });

// - Erouter
const erouterRegisterEvent = createMessage(key`socket.erouter.${'deviceId'}.register`, deviceAsPayload);
const erouterCloseEvent = createMessage(key`socket.erouter.${'deviceId'}.close`, deviceId => ({ deviceId }));
const erouterInterfacesEvent = createMessage(key`socket.erouter.${'deviceId'}.interfaces`, messagePayload);
const erouterSystemEvent = createMessage(key`socket.erouter.${'deviceId'}.system`, messagePayload);
const erouterUpdateEvent = createMessage(key`socket.erouter.${'deviceId'}.update`, deviceIdAndPayload);
const erouterConfigChangeEvent = createMessage(key`socket.erouter.${'deviceId'}.config-change`, emptyPayload);

// - Eswitch
const eswitchRegisterEvent = createMessage(key`socket.eswitch.${'deviceId'}.register`, deviceAsPayload);
const eswitchCloseEvent = createMessage(key`socket.eswitch.${'deviceId'}.close`, deviceId => ({ deviceId }));
const eswitchUpdateEvent = createMessage(key`socket.eswitch.${'deviceId'}.update`, deviceIdAndPayload);
const eswitchStatisticsEvent = createMessage(key`socket.eswitch.${'deviceId'}.statistics`, deviceIdAndPayload);
const eswitchConfigChangeEvent = createMessage(key`socket.eswitch.${'deviceId'}.config-change`, emptyPayload);

// - Olt
const oltRegisterEvent = createMessage(key`socket.olt.${'deviceId'}.register`, deviceAsPayload);
const oltCloseEvent = createMessage(key`socket.olt.${'deviceId'}.close`, deviceId => ({ deviceId }));
const oltInterfacesEvent = createMessage(key`socket.olt.${'deviceId'}.interfaces`, messagePayload);
const oltSystemEvent = createMessage(key`socket.olt.${'deviceId'}.system`, messagePayload);
const oltPonEvent = createMessage(key`socket.olt.${'deviceId'}.pon`, messagePayload);
const oltOnuListEvent = createMessage(key`socket.olt.${'deviceId'}.onu-list`, deviceIdAndPayload);
const oltUpdateEvent = createMessage(key`socket.olt.${'deviceId'}.update`, deviceIdAndPayload);
const oltConfigChangeEvent = createMessage(key`socket.olt.${'deviceId'}.config-change`, emptyPayload);
const oltGotUnsupportedOnuEvent = createMessage(key`socket.olt.${'deviceId'}.unsupported-onu`, deviceWithId);

// - AirMax
const airMaxRegisterEvent = createMessage(key`socket.airmax.${'deviceId'}.register`, deviceAsPayload);
const airMaxCloseEvent = createMessage(key`socket.airmax.${'deviceId'}.close`, emptyPayload);
const airMaxUpdateEvent = createMessage(key`socket.airmax.${'deviceId'}.update`, deviceIdAndPayload);
const airMaxStatisticsEvent = createMessage(key`socket.airmax.${'deviceId'}.statistics`, deviceIdAndPayload);
const airMaxConfigChangeEvent = createMessage(key`socket.airmax.${'deviceId'}.config-change`, emptyPayload);

// - AirCube
const airCubeRegisterEvent = createMessage(key`socket.aircube.${'deviceId'}.register`, deviceAsPayload);
const airCubeCloseEvent = createMessage(key`socket.aircube.${'deviceId'}.close`, emptyPayload);
const airCubeUpdateEvent = createMessage(key`socket.aircube.${'deviceId'}.update`, deviceIdAndPayload);
const airCubeStatisticsEvent = createMessage(key`socket.aircube.${'deviceId'}.statistics`, deviceIdAndPayload);
const airCubeConfigChangeEvent = createMessage(key`socket.aircube.${'deviceId'}.config-change`, emptyPayload);


/**
 * @alias {Messages}
 */
module.exports = {
  // device
  deviceSaved,
  deviceRemoved,
  deviceRestarted,
  deviceRefreshed,

  deviceDisconnected,
  deviceConnected,

  deviceConnectionSuccess,
  deviceConnectionFailure,

  deviceOutageStopped,

  // settings
  settingsChanged,

  // users
  userRemoved,
  userCreated,
  userUpdated,
  userUpdatedEmailSendingFailed,
  userRemovedEmailSendingFailed,
  userInvitedEmailSendingFailed,
  userPasswordResetRequested,

  // socket
  erouterRegisterEvent,
  erouterCloseEvent,
  erouterInterfacesEvent,
  erouterSystemEvent,
  erouterUpdateEvent,
  erouterConfigChangeEvent,

  eswitchRegisterEvent,
  eswitchCloseEvent,
  eswitchUpdateEvent,
  eswitchStatisticsEvent,
  eswitchConfigChangeEvent,

  oltRegisterEvent,
  oltCloseEvent,
  oltInterfacesEvent,
  oltSystemEvent,
  oltPonEvent,
  oltOnuListEvent,
  oltUpdateEvent,
  oltConfigChangeEvent,
  oltGotUnsupportedOnuEvent,

  airMaxRegisterEvent,
  airMaxCloseEvent,
  airMaxUpdateEvent,
  airMaxStatisticsEvent,
  airMaxConfigChangeEvent,

  airCubeRegisterEvent,
  airCubeCloseEvent,
  airCubeUpdateEvent,
  airCubeStatisticsEvent,
  airCubeConfigChangeEvent,
};
