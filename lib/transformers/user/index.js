'use strict';

const { toCorrespondence, fromCorrespondence } = require('../index');
const {
  safeToApiUser, safeToDbUser, safeToDbUserProfile, safeToApiUserProfile, safeToApiUsers, safeToHapiCredentials,
} = require('./mappers');
const {
  safeParseDbUser, safeParseApiUser, safeParseApiUserPassword, safeParseApiUserCredentials,
  safeParseDbUserProfile, safeParseApiUserUpdate, safeParseApiUserProfile, safeParseDbUsers,
  safeParseDbUserProfiles,
} = require('./parsers');

const fromApiUser = toCorrespondence(safeParseApiUser);

const fromApiUserPassword = toCorrespondence(safeParseApiUserPassword, {});

const fromApiUserUpdate = toCorrespondence(safeParseApiUserUpdate, {});

const fromApiUserProfile = toCorrespondence(safeParseApiUserProfile, {});

const fromApiUserCredentials = toCorrespondence(safeParseApiUserCredentials, {});

// fromDbUser :: Auxiliaries -> DbUser -> Either.<UserCorrespondenceData>
//    Auxiliaries = Object
//    DbUser = Object
//    UserCorrespondenceData = Object
const fromDbUser = toCorrespondence(safeParseDbUser);

const fromDbUsers = toCorrespondence(safeParseDbUsers);

const fromDbUserProfile = toCorrespondence(safeParseDbUserProfile, {});
const fromDbUserProfiles = toCorrespondence(safeParseDbUserProfiles, {});

// toApiUser :: Object<UserCorrenspondeceData> -> Either.<ApiUser>
//     ApiUser = Object
const toApiUser = fromCorrespondence(safeToApiUser);

const toApiUsers = fromCorrespondence(safeToApiUsers);

const toApiUserProfile = fromCorrespondence(safeToApiUserProfile);

const toDbUser = fromCorrespondence(safeToDbUser);

const toDbUserProfile = fromCorrespondence(safeToDbUserProfile);

const toHapiCredentials = fromCorrespondence(safeToHapiCredentials);

module.exports = {
  fromApiUser,
  fromApiUserPassword,

  fromApiUserProfile,

  fromDbUser,
  fromDbUsers,
  fromDbUserProfile,
  fromDbUserProfiles,

  fromApiUserUpdate,
  fromApiUserCredentials,

  toApiUser,
  toApiUsers,
  toApiUserProfile,

  toDbUser,
  toDbUserProfile,

  toHapiCredentials,
};
