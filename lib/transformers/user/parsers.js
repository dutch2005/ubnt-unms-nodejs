'use strict';

const aguid = require('aguid');
const { pathOr, path, always, defaultTo, map, ifElse, is, pick } = require('ramda');
const { keyBy } = require('lodash/fp');
const { liftParser } = require('../index');

// parseDbUserProfile :: (Auxiliaries, DbUserProfile) -> CmUserProfile
const parseDbUserProfile = (auxiliaries, dbUserProfile) => ({
  userId: dbUserProfile.userId,
  alerts: dbUserProfile.alerts,
  presentationMode: dbUserProfile.presentationMode,
  forceChangePassword: dbUserProfile.forceChangePassword,
  lastLogItemId: dbUserProfile.lastLogItemId,
  tableConfig: defaultTo({}, dbUserProfile.tableConfig),
  lastNewsSeenDate: defaultTo(null, dbUserProfile.lastNewsSeenDate),
});

const parseDbUserProfiles = (auxiliaries, dbUserProfiles) =>
  map(dbUserProfile => parseDbUserProfile({}, dbUserProfile))(dbUserProfiles);

// parseDbUser :: (Auxiliaries, DbUser) -> UserCorrespondenceData
//    Auxiliaries = Object
//    DbUser = Object
//    UserCorrespondenceData = Object
const parseDbUser = (auxiliaries, dbUser) => ({
  id: dbUser.id,
  email: dbUser.email,
  username: dbUser.username,
  password: dbUser.password,
  totpAuthEnabled: dbUser.totpAuthEnabled,
  totpAuthSecret: dbUser.totpAuthSecret,
  role: dbUser.role,
  profile: ifElse(
    is(Object),
    pick(['alerts', 'presentationMode', 'forceChangePassword', 'lastLogItemId', 'tableConfig', 'lastNewsSeenDate']),
    always(null)
  )(auxiliaries.cmUserProfile),
});

// parseDbUsers :: (Auxiliaries, DbUsers) -> UserCorrespondenceData[]
//    Auxiliaries = Object
//    DbUsers = Array.<Object>
//    UserCorrespondenceData = Array.<Object>
const parseDbUsers = (auxiliaries, dbUsers) => {
  const profilesById = keyBy('userId', auxiliaries.cmUserProfiles);
  return dbUsers.map(
    dbUser => parseDbUser({ cmUserProfile: pathOr(null, [dbUser.id], profilesById) }, dbUser)
  );
};

// parseApiUser :: ({ CmUser }, ApiUser) -> CmUser
//    CmUser = Object
//    ApiUser = Object
const parseApiUser = (auxiliaries, apiUser) => ({
  id: pathOr(aguid(), ['id'], apiUser),
  username: path(['username'], apiUser),
  email: path(['email'], apiUser),
  password: pathOr(null, ['cmUser', 'password'], auxiliaries),
  totpAuthEnabled: pathOr(false, ['totpAuthEnabled'], apiUser),
  totpAuthSecret: pathOr(null, ['cmUser', 'totpAuthSecret'], auxiliaries),
  role: pathOr(pathOr(null, ['cmUser', 'role'], auxiliaries), ['role'], apiUser),
  profile: {
    alerts: pathOr(false, ['alerts'], apiUser),
    presentationMode: pathOr(false, ['cmUser', 'profile', 'presentationMode'], auxiliaries),
    forceChangePassword: pathOr(false, ['cmUser', 'profile', 'forceChangePassword'], auxiliaries),
    lastLogItemId: pathOr(null, ['cmUser', 'profile', 'lastLogItemId'], auxiliaries),
    tableConfig: pathOr(null, ['cmUser', 'profile', 'tableConfig'], auxiliaries),
  },
});

// parseApiUserPassword :: (Auxiliaries, ApiUser) -> String
//    Auxiliaries = Object
//    ApiUser = Object
const parseApiUserPassword = (auxiliaries, apiUser) => apiUser.password;

// parseApiUserCurrentPassword :: (Auxiliaries, ApiUser) -> String
//    Auxiliaries = Object
//    ApiUser = Object
const parseApiUserCurrentPassword = (auxiliaries, apiUser) => apiUser.currentPassword;

const parseApiUserUpdate = (auxiliaries, apiUser) => ({
  id: apiUser.id,
  username: apiUser.username,
  email: apiUser.email,
  currentPassword: apiUser.currentPassword,
  newPassword: defaultTo(null, apiUser.newPassword),
});

// parseApiUserProfile :: (Auxiliaries, ApiUserProfile) -> CmUserProfile
const parseApiUserProfile = (auxiliaries, apiUserProfile) => ({
  userId: apiUserProfile.userId,
  alerts: null,
  presentationMode: apiUserProfile.presentationMode,
  forceChangePassword: apiUserProfile.forceChangePassword,
  lastLogItemId: apiUserProfile.lastLogItemId,
  tableConfig: apiUserProfile.tableConfig,
  lastNewsSeenDate: null,
});

const parseApiUserCredentials = (auxiliaries, apiCredentials) => ({
  username: apiCredentials.username,
  password: apiCredentials.password,
  sessionTimeout: apiCredentials.sessionTimeout,
});

module.exports = {
  parseDbUser,
  parseDbUsers,
  parseDbUserProfile,
  parseDbUserProfiles,

  parseApiUser,
  parseApiUserPassword,
  parseApiUserCurrentPassword,
  parseApiUserUpdate,
  parseApiUserProfile,
  parseApiUserCredentials,

  safeParseDbUser: liftParser(parseDbUser),
  safeParseDbUsers: liftParser(parseDbUsers),
  safeParseDbUserProfile: liftParser(parseDbUserProfile),
  safeParseDbUserProfiles: liftParser(parseDbUserProfiles),
  safeParseApiUser: liftParser(parseApiUser),
  safeParseApiUserPassword: liftParser(parseApiUserPassword),
  safeParseApiUserCurrentPassword: liftParser(parseApiUserCurrentPassword),
  safeParseApiUserCredentials: liftParser(parseApiUserCredentials),

  safeParseApiUserUpdate: liftParser(parseApiUserUpdate),

  safeParseApiUserProfile: liftParser(parseApiUserProfile),
};
