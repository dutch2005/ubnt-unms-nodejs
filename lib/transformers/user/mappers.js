'use strict';

const { map } = require('ramda');
const { liftMapper } = require('../index');

// toApiUser :: Object -> ApiUser
//     ApiUser = Object
const toApiUser = cmUser => ({
  id: cmUser.id,
  username: cmUser.username,
  email: cmUser.email,
  alerts: cmUser.profile.alerts,
  totpAuthEnabled: cmUser.totpAuthEnabled,
  role: cmUser.role,
});

const toApiUsers = map(toApiUser);

const toDbUser = cmUser => ({
  id: cmUser.id,
  username: cmUser.username,
  email: cmUser.email,
  password: cmUser.password,
  totpAuthEnabled: cmUser.totpAuthEnabled,
  totpAuthSecret: cmUser.totpAuthSecret,
  role: cmUser.role,
});

const toDbUserProfile = cmUser => ({
  userId: cmUser.id,
  alerts: cmUser.profile.alerts,
  presentationMode: cmUser.profile.presentationMode,
  forceChangePassword: cmUser.profile.forceChangePassword,
  lastLogItemId: cmUser.profile.lastLogItemId,
  tableConfig: cmUser.profile.tableConfig,
  lastNewsSeenDate: cmUser.profile.lastNewsSeenDate,
});

const toApiUserProfile = cmUser => ({
  userId: cmUser.id,
  presentationMode: cmUser.profile.presentationMode,
  forceChangePassword: cmUser.profile.forceChangePassword,
  lastLogItemId: cmUser.profile.lastLogItemId,
  tableConfig: cmUser.profile.tableConfig,
});

const toHapiCredentials = cmUser => ({
  id: cmUser.id,
  email: cmUser.email,
  scope: [cmUser.role],
});

module.exports = {
  toApiUser,
  toApiUsers,
  toApiUserProfile,

  toDbUser,
  toDbUserProfile,

  toHapiCredentials,

  safeToApiUser: liftMapper(toApiUser),
  safeToApiUsers: liftMapper(toApiUsers),
  safeToApiUserProfile: liftMapper(toApiUserProfile),

  safeToDbUser: liftMapper(toDbUser),
  safeToDbUserProfile: liftMapper(toDbUserProfile),

  safeToHapiCredentials: liftMapper(toHapiCredentials),
};
