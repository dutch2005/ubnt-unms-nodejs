'use strict';

const zxcvbn = require('zxcvbn');
const { Reader: reader, Either } = require('monet');
const {
  assoc, assocPath, path, always, filter, pathEq, map, when, pathSatisfies, equals,
  ifElse, applySpec, prop, pathOr, pickBy, apply, lt, zipObj, pipe, __, merge,
} = require('ramda');
const { weave, isNotNull, isNotNil, isNilOrEmpty } = require('ramda-adjunct');
const { FlutureTMonetEither: FutureTEither } = require('monad-t');
const Boom = require('boom');

const {
  fromDbUsers, toApiUser, fromApiUser, fromApiUserPassword, fromDbUserProfile, fromDbUser,
  toDbUser, toDbUserProfile, fromDbUserProfiles, fromApiUserUpdate, fromApiUserProfile, fromApiUserCredentials,
} = require('../transformers/user');
const { fromApiMobileDevice, toDbMobileDevice } = require('../transformers/mobileDevice');
const { merge: mergeM } = require('../transformers');
const { generatePasswordHashF } = require('../auth');
const { mergeUserUpdate } = require('../transformers/user/mergers');
const { getUnmsHostname } = require('../util');
const config = require('../../config');
const {
  validatePasswordF, signUserToken, createToken, checkVerificationCode,
  generateTwoFactorVerification, encrypt, createPasswordResetToken,
} = require('../auth');

const getUsers = () => reader(
  ({ dal }) => FutureTEither
    .do(function* async() {
      const cmUserProfiles = yield FutureTEither.tryP(dal.userProfileRepository.findAll)
        .chainEither(fromDbUserProfiles);

      return yield FutureTEither
        .tryP(dal.userRepository.findAll)
        .chainEither(fromDbUsers({ cmUserProfiles }));
    })
);

const countUsers = () => reader(
  ({ dal }) => FutureTEither
    .tryP(dal.userRepository.count)
    .map(path([0, 'count']))
);

const createUser = payload => reader(
  ({ dal, messageHub }) => FutureTEither.do(function* async() {
    const encPass = yield FutureTEither
      .fromEither(fromApiUserPassword(payload))
      .chainFuture(generatePasswordHashF);

    return yield FutureTEither
      .fromEither(fromApiUser({ cmDbUser: null }, payload))
      .map(assoc('password', encPass))
      .map(assocPath(['profile', 'forceChangePassword'], true));
  })
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUser(cmUser))
      .chain(FutureTEither.encaseP(dal.userRepository.create))
    )
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUserProfile(cmUser))
      .chain(FutureTEither.encaseP(dal.userProfileRepository.upsert))
    )
    .tap(cmUser => messageHub.publish(messageHub.messages.userCreated(cmUser)))
    .mapRej(when(
      pathSatisfies(equals('unique violation'), ['errors', 0, 'type']),
      always(Boom.conflict('User already exists'))
    ))
);

const updateUser = (userId, payload) => reader(
  ({ dal }) => FutureTEither.do(function* async() {
    const cmUserProfile = yield FutureTEither
      .encaseP(dal.userProfileRepository.findByUserId, userId)
      .chainEither(fromDbUserProfile);

    const dbUser = yield FutureTEither.encaseP(dal.userRepository.findById, userId);
    const cmDbUserM = fromDbUser({ cmUserProfile }, dbUser);
    const cmApiUserM = fromApiUser({ cmUser: yield FutureTEither.fromEither(cmDbUserM) }, payload);

    return yield FutureTEither.fromEither(cmDbUserM.chain(mergeM(mergeUserUpdate, cmApiUserM)));
  })
    .filter(pathEq(['id'], userId), Boom.badData('Path user ID must match payload'))
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUser(cmUser))
      .chain(FutureTEither.encaseP2(dal.userRepository.update, userId))
    )
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUserProfile(cmUser))
      .chain(FutureTEither.encaseP(dal.userProfileRepository.upsert))
    )
    .mapRej(when(
      pathSatisfies(equals('unique violation'), ['errors', 0, 'type']),
      always(Boom.conflict('User already exists.'))
    ))
);

const sendInvitationEmail = ({ user, nms }) => reader(
  ({ mail }) => {
    const sender = mail.configureAndSendAdminInvite(nms.smtp);
    const mailData = { to: user.email };
    const context = { adminName: user.username, unmsHostname: getUnmsHostname(nms) };

    return sender(mailData, context);
  }
);

const reinviteUser = userId => reader(
  ({ DB, mail, dal }) => FutureTEither.do(function* async() {
    const cmUserProfile = yield FutureTEither
      .encaseP(dal.userProfileRepository.findByUserId, userId)
      .chainEither(fromDbUserProfile);

    const cmUser = yield FutureTEither
      .encaseP(dal.userRepository.findById, userId)
      .chainEither(fromDbUser({ cmUserProfile }));

    const nms = yield FutureTEither.tryP(DB.nms.get);

    const apiUser = yield FutureTEither.fromEither(toApiUser(cmUser));

    yield FutureTEither.encaseP(weave(sendInvitationEmail, { mail }), { nms, user: apiUser });

    return { result: true, message: 'User reinvited' };
  })
);

const deleteUser = userId => reader(
  ({ DB, dal, messageHub }) => FutureTEither
    .encaseP(dal.userRepository.findById, userId)
    .chainEither(fromDbUser({}))
    .tapF(cmUser => FutureTEither.encaseP(dal.userRepository.remove, cmUser.id))
    .tapF(cmUser => FutureTEither
      .tryP(DB.token.list)
      .map(filter(pathEq(['userId'], cmUser.id)))
      .map(map(FutureTEither.encaseP(DB.token.remove)))
      .chain(tokenFTE => FutureTEither.parallel(1, tokenFTE))
    )
    .tap(cmUser => messageHub.publish(messageHub.messages.userRemoved(cmUser)))
    .map(always({ result: true, message: 'user deleted' }))
);

const rp = require('request-promise-native');

const getUser = userId => reader(
  ({ dal }) => FutureTEither.do(function* async() {
    const cmUserProfile = yield FutureTEither
      .encaseP(dal.userProfileRepository.findByUserId, userId)
      .chainEither(fromDbUserProfile);

    return yield FutureTEither
      .encaseP(dal.userRepository.findById, userId)
      .chainEither(fromDbUser({ cmUserProfile }));
  })
);

const updateUserWithAuth = (userId, payload) => reader(
  ({ dal, messageHub }) => FutureTEither.do(function* async() {
    // load & parse userProfile from DB
    const cmUserProfile = yield FutureTEither
      .encaseP(dal.userProfileRepository.findByUserId, userId)
      .chainEither(fromDbUserProfile);

    // load & parse user from DB
    const cmUser = yield FutureTEither.encaseP(dal.userRepository.findById, userId)
      .chainEither(fromDbUser({ cmUserProfile }));

    // create updated cmUser
    return yield FutureTEither
      .fromEither(fromApiUserUpdate(payload))

      // validate password
      .tapF(cmUserUpdate => FutureTEither
        .fromFuture(validatePasswordF(cmUserUpdate.currentPassword, cmUser.password))
        .filter(equals(true), Boom.unauthorized())
      )

      // hash new password if applicable
      .chain(ifElse(
        pathSatisfies(isNotNull, ['newPassword']),
        update => FutureTEither
          .fromFuture(generatePasswordHashF(update.newPassword))
          .map(assoc('newPassword', __, update)),
        update => FutureTEither.fromValue(update)
      ))

      // remap  to object mergeable to user
      .map(applySpec({
        username: pathOr(null, ['username']),
        email: pathOr(null, ['email']),
        password: pathOr(null, ['newPassword']),
      }))
      .map(pickBy(isNotNull))

      .map(merge(cmUser))

      // save modified user to DB
      .tapF(FutureTEither.encaseP2(dal.userRepository.update, cmUser.id))

      // fire & forget notification
      .tapF(cmUserMod => FutureTEither
        .both(
        FutureTEither.fromEither(toApiUser(cmUser)),
        FutureTEither.fromEither(toApiUser(cmUserMod))
        )
        .tap(([apiUserPristine, apiUserModified]) =>
          messageHub.publish(messageHub.messages.userUpdated(apiUserPristine, apiUserModified))
        )
      );
  })
);

const getUserProfile = userId => reader(
  ({ dal }) => FutureTEither.encaseP(dal.userProfileRepository.findByUserId, userId)
    .chainEither(fromDbUserProfile)
);

const updateUserProfile = (userId, payload) => reader(
  ({ dal }) => FutureTEither
    .both(
    FutureTEither.encaseP(dal.userProfileRepository.findByUserId, userId)
      .chainEither(fromDbUserProfile),
    FutureTEither.fromEither(fromApiUserProfile(payload))
      .map(pickBy(isNotNull))
      .map(assoc('userId', userId))
    )
    .map(apply(merge))
    .chain(cmUserProfile => FutureTEither
      .encaseP(dal.userRepository.findById, userId)
      .chainEither(fromDbUser({ cmUserProfile }))
    )
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUserProfile(cmUser))
      .chain(FutureTEither.encaseP(dal.userProfileRepository.upsert))
    )
);

const generateSignedTokenFTE = (sessionTimeout, cmUser) => reader(
  ({ DB }) => FutureTEither.fromValue(cmUser)
    .map(createToken(sessionTimeout))
    .tapF(FutureTEither.encaseP(DB.token.insert))
    .chainFuture(signUserToken)
);

const generateTwoFactorToken = cmUser => reader(
  ({ DB }) => FutureTEither.fromValue(cmUser)
    .map(createToken(config.sessionTimeout))
    .tapF(FutureTEither.encaseP(DB.twoFactorToken.insert))
);

const login = payload => reader(
  ({ dal, DB }) => FutureTEither.do(function* async() {
    const cmCredentials = yield FutureTEither.fromEither(fromApiUserCredentials(payload));

    const dbUser = yield FutureTEither
      .encaseP(dal.userRepository.findByUsername, cmCredentials.username)
      .filter(isNotNull, Boom.unauthorized());

    const cmUserProfile = yield FutureTEither
      .encaseP(dal.userProfileRepository.findByUserId, dbUser.id)
      .chainEither(fromDbUserProfile);

    return yield FutureTEither
      .fromEither(fromDbUser({ cmUserProfile }, dbUser))
      .tapF(
      cmUser => FutureTEither
        .fromFuture(validatePasswordF(cmCredentials.password, cmUser.password))
        .filter(equals(true), Boom.unauthorized())
      )
      .chain(ifElse(
        pathEq(['totpAuthEnabled'], true),

        // two-factor login procedure
        cmUser => generateTwoFactorToken(cmUser)
          .run({ DB })
          .map(tfToken => [cmUser, null, tfToken]),

        // normal login procedure
        cmUser =>
          generateSignedTokenFTE(cmCredentials.sessionTimeout, cmUser)
            .run({ DB })
            .map(signedToken => [cmUser, signedToken, null])
      ));
  })
);

const loginTotp = payload => reader(
  ({ dal, DB }) => FutureTEither
    .encaseP(DB.twoFactorToken.findById, payload.token)
    .filter(isNotNil, Boom.unauthorized())
    .filter(pathSatisfies(lt(Date.now()), ['exp']), Boom.notAcceptable('Token has expired'))
    .chain(tfToken => getUser(tfToken.userId).run({ dal }))
    .tapF(cmUser => FutureTEither
      .fromValue(checkVerificationCode(payload.verificationCode, payload.password, cmUser))
      .filter(equals(true), Boom.forbidden('Bad verification code'))
    )
    .chain(cmUser => FutureTEither.both(
      FutureTEither.fromValue(cmUser),
      generateSignedTokenFTE(payload.sessionTimeout, cmUser).run({ DB })
    ))
    .tapF(() => FutureTEither
      .encaseP(DB.twoFactorToken.findById, payload.token)
      .chain(FutureTEither.encaseP(DB.twoFactorToken.remove))
    )
);

const logout = tokenId => reader(
  ({ DB }) => FutureTEither
    .encaseP(DB.token.findById, tokenId)
    .filter(isNotNil, Boom.unauthorized())
    .tapF(FutureTEither.encaseP(DB.token.remove))
    .map(always({ result: true, message: 'Successfully logged out.' }))
);

const generateTwoFactorAuthSecret = userId => reader(
  ({ dal, DB }) => FutureTEither.both(
    getUser(userId)
      .run({ dal })
      .chainEither(toApiUser),
    FutureTEither.tryP(DB.nms.get)
  )
    .map(zipObj(['pristineUser', 'nms']))
    .map(generateTwoFactorVerification)
);

const setTotpAuth = (userId, payload) => reader(
  ({ dal }) => getUser(userId)
    .run({ dal })
    .map(assoc('totpAuthEnabled', payload.totpAuthEnabled))
    .map(ifElse(
      pathEq(['totpAuthEnabled'], true),
      cmUser => assoc('totpAuthSecret', encrypt(payload.password, payload.totpAuthSecret), cmUser),
      assoc('totpAuthSecret', null)
    ))
    .tapF(ifElse(
      pathEq(['totpAuthEnabled'], true),
      cmUser => FutureTEither
        .fromFuture(validatePasswordF(payload.password, cmUser.password))
        .filter(equals(true), Boom.unauthorized())
        .and(FutureTEither
          .fromValue(checkVerificationCode(payload.verificationCode, payload.password, cmUser))
          .filter(equals(true), Boom.forbidden('Bad verification code'))
        ),
      always(FutureTEither.fromValue(true))
    ))
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUser(cmUser))
      .chain(FutureTEither.encaseP2(dal.userRepository.update, userId))
    )
);

const requestPasswordReset = email => reader(
  ({ dal, DB, messageHub }) => FutureTEither.do(function* async() {
    const { messages } = messageHub;
    const cmUser = yield FutureTEither
      .encaseP(dal.userRepository.findByEmail, email)
      .filter(isNotNull, Boom.notFound('Token not found'))
      .chainEither(fromDbUser({ cmUserProfile: null }));

    return yield FutureTEither
      .fromValue(cmUser)
      .map(createPasswordResetToken)
      .tapF(FutureTEither.encaseP(DB.passwordToken.insert))
      .map(passwordToken => messageHub.publish(messages.userPasswordResetRequested(cmUser, passwordToken)))
      .map(always({ result: true, message: 'Reset link has been sent to provided email' }));
  })
);

const registerMobileDeviceInCloud = (unmsId, cmMobileDevice) => reader(
  ({ config: appConfig }) => rp({
    method: 'POST',
    uri: `${appConfig.pushNotificationServiceUrl}/api/device`,
    headers: {
      'User-Agent': 'UNMS',
      'x-instance-id': unmsId,
    },
    json: true,
    body: {
      token: cmMobileDevice.deviceToken,
      platform: cmMobileDevice.platform,
    },
  })
);

const createMobileDevice = (userId, payload) => reader(
  ({ dal, config: appConfig, DB }) => FutureTEither
    .do(function* async() {
      if (isNilOrEmpty(appConfig.pushNotificationServiceUrl)) {
        return yield FutureTEither.fromEither(Either.Left(Boom.notImplemented()));
      }

      const nms = yield FutureTEither.tryP(DB.nms.get);
      const cmMobileDevice = yield FutureTEither.fromEither(fromApiMobileDevice({ userId }, payload));

      const registerMobileDeviceInCloudBound = weave(registerMobileDeviceInCloud, { config: appConfig });

      const { deviceKey } = yield FutureTEither
        .encaseP2(registerMobileDeviceInCloudBound, nms.instanceId, cmMobileDevice)
        .mapRej(error => Boom.wrap(error, error.statusCode));

      return assoc('deviceKey', deviceKey, cmMobileDevice);
    })
    .tapF(
    cmMobileDevice => FutureTEither
      .fromEither(toDbMobileDevice(cmMobileDevice))
      .chain(FutureTEither.encaseP(dal.mobileDeviceRepository.save))
    )
    .map(always({ result: true, message: 'Device registered.' }))
    .promise()
);

const resetPasswordUsingToken = (token, password) => reader(
  ({ dal, DB }) => FutureTEither
    .encaseP(DB.passwordToken.findById, token)
    .filter(isNotNil, Boom.notFound('Token not found'))
    .filter(pathSatisfies(lt(Date.now()), ['exp']), Boom.notAcceptable('Token has expired'))
    .tapF(FutureTEither.encaseP(DB.passwordToken.remove))
    .chain(pipe(prop('userId'), FutureTEither.encaseP(dal.userRepository.findById)))
    .filter(isNotNull, Boom.resourceGone('User no longer available.'))
    .chainEither(fromDbUser({ cmUserProfile: null }))
    .chain(cmUser => FutureTEither.both(
      FutureTEither.fromFuture(generatePasswordHashF(password)),
      FutureTEither.fromValue(cmUser)
    ))
    .map(apply(assoc('password')))
    .map(assoc('totpAuthEnabled', false))
    .map(assoc('totpAuthSecret', null))
    .tapF(cmUser => FutureTEither
      .fromEither(toDbUser(cmUser))
      .chain(FutureTEither.encaseP2(dal.userRepository.update, cmUser.id))
    )
    .map(always({ result: true, message: 'Password changed' }))
);


module.exports = {
  getUser,
  getUsers,
  updateUser,
  updateUserWithAuth,
  createUser,
  getUserProfile,
  updateUserProfile,
  countUsers,
  reinviteUser,
  deleteUser,

  login,
  loginTotp,
  logout,
  generateTwoFactorAuthSecret,
  setTotpAuth,
  requestPasswordReset,
  createMobileDevice,
  resetPasswordUsingToken,
  checkPasswordStrength: zxcvbn,
};
