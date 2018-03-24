'use strict';

const { Reader: reader } = require('monet');
const { assoc, assocPath, path, always, filter, pathEq, map, when, pathSatisfies, equals } = require('ramda');
const { weave } = require('ramda-adjunct');
const { FlutureTMonetEither: FutureTEither } = require('monad-t');
const Boom = require('boom');

const {
  fromDbUsers, toApiUser, fromApiUser, fromApiUserPassword, fromDbUserProfile, fromDbUser,
  toDbUser, toDbUserProfile, fromDbUserProfiles,
} = require('../../../transformers/user');
const { merge } = require('../../../transformers');
const { generatePasswordHashF } = require('../../../auth');
const { mergeUserUpdate } = require('../../../transformers/user/mergers');
const { getUnmsHostname } = require('../../../util');

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
      always(Boom.conflict())
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

    return yield FutureTEither.fromEither(cmDbUserM.chain(merge(mergeUserUpdate, cmApiUserM)));
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
      always(Boom.conflict())
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

module.exports = {
  getUsers,
  countUsers,
  createUser,
  updateUser,
  reinviteUser,
  deleteUser,
};
