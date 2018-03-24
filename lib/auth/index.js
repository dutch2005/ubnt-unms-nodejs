'use strict';

const { Reader: reader } = require('monet');
const { FlutureTMonetEither: FutureTEither } = require('monad-t');
const aguid = require('aguid');
const { get, curry, curryRight, sum } = require('lodash');
const { map, filter, invokeArgs, getOr } = require('lodash/fp');
const { converge, concat, pipe, prop, ifElse, anyPass, is } = require('ramda');
const { isNotNull } = require('ramda-adjunct');
const { randomBytes, createCipher, createDecipher } = require('crypto');
const { hashSync, compareSync, hash, compare, genSalt } = require('bcrypt');
const speakeasy = require('speakeasy');
const Future = require('fluture');
const JWT = require('jsonwebtoken');
const base32 = require('base32.js');

const { DB } = require('../db');
const { log } = require('../logging');
const config = require('../../config');
const { fromDbUser, toHapiCredentials } = require('../transformers/user');

const jwtKey = config.isDevelopment
  ? 'constant key for development'
  : randomBytes(256).toString('base64');

const filterExpired = curryRight((item, property, currentTimestamp) => currentTimestamp > get(item, property, 0));

const generatePasswordHash = password => (hashSync(password, config.pwdSaltRounds));
const validatePassword = (password, encrypted) => compareSync(password, encrypted);

const generatePasswordHashF = password => Future.encaseN(genSalt, config.pwdSaltRounds)
  .chain(Future.encaseN2(hash, password));

const generatePasswordHashP = password => generatePasswordHashF(password)
  .promise();

const validatePasswordF = (password, encrypted) => Future.encaseN2(compare, password, encrypted);

const validatePasswordP = (password, encrypted) => validatePasswordF(password, encrypted)
  .promise();

class TokenExpiryError extends Error {}

class InvalidUserError extends Error {}

const isInvalidTokenError = anyPass([
  is(TokenExpiryError),
  is(InvalidUserError),
]);

const validateTokenExpiry = (token) => {
  if (token && token.exp > Date.now()) {
    return true;
  }

  return false;
};

/* eslint-disable no-param-reassign */
const decorateRequestWithToken = curry((request, token) => { request.token = token; return token });
/* eslint-enable no-param-reassign */

const validate = (decoded, request, callback) => reader(
  ({ dal }) => FutureTEither.encaseP(DB.token.findById, decoded.id)
    .filter(validateTokenExpiry, new TokenExpiryError())
    .map(decorateRequestWithToken(request))
    .chain(pipe(prop('userId'), FutureTEither.encaseP(dal.userRepository.findById)))
    .filter(isNotNull, new InvalidUserError())
    .chainEither(fromDbUser({}))
    .chainEither(toHapiCredentials)
    .fork(
      // closures required - !ifElse does autocurrying!
      ifElse(
        isInvalidTokenError,
        err => callback(null, false, err),
        err => callback(err)
      ),
      credentials => callback(null, true, credentials)
    )
);

const generateTwoFactorVerification = (info) => {
  const secret = randomBytes(32);
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    encoding: 'base32',
    label: info.pristineUser.email,
    issuer: `${config.totpAuthSecretOptions.issuer}: ${getOr(config.defaultNmsHostname, ['nms', 'hostname'], info)}`,
  });
  return {
    base32: base32.encode(secret),
    otpauth_url: otpauthUrl,
  };
};

const twoFactorVerification = (verificationCode, totpAuthSecret) => speakeasy.totp.verify({
  secret: totpAuthSecret,
  encoding: 'base32',
  token: verificationCode,
});

const encrypt = curry((key, data) => {
  const cipherEncrypt = converge(concat, [invokeArgs('update', [data, 'utf8', 'hex']), invokeArgs('final', ['hex'])]);
  return cipherEncrypt(createCipher(config.hashAlgorithm, key));
});

const decipher = curry((key, data) => {
  const cipherEncrypt = converge(concat, [invokeArgs('update', [data, 'hex', 'utf8']), invokeArgs('final', ['utf8'])]);
  return cipherEncrypt(createDecipher(config.hashAlgorithm, key));
});

function cleanExpiredAuthTokens(time = Date.now()) {
  return DB.token.list()
    .then(filter(filterExpired('exp', time)))
    .then(map(DB.token.remove))
    .then(Promise.all.bind(Promise))
    .then(sum)
    .then(deleted => `${deleted} expired tokens deleted.`)
    .then(log(['info']));
}

function cleanExpiredPasswordTokens(time = Date.now()) {
  return DB.passwordToken.list()
    .then(filter(filterExpired('exp', time)))
    .then(map(DB.passwordToken.remove))
    .then(Promise.all.bind(Promise))
    .then(sum)
    .then(deleted => `${deleted} expired password tokens deleted.`)
    .then(log(['info']));
}

const createToken = curry((sessionTimeout, cmUser) => ({
  id: aguid(), // a random session id
  exp: Date.now() + sessionTimeout,
  userId: cmUser.id,
  extendedSessionTimeout: sessionTimeout > config.sessionTimeout,
}));

const createPasswordResetToken = cmUser => ({
  id: aguid(),
  userId: cmUser.id,
  exp: Date.now() + config.passwordTokenExpiry,
});

const signUserToken = userToken => Future.encaseN3(JWT.sign, userToken, jwtKey, null);

const checkVerificationCode = curry((verificationCode, password, user) => {
  if (user.totpAuthEnabled) {
    return twoFactorVerification(verificationCode, decipher(password, user.totpAuthSecret));
  }
  return true;
});

module.exports = {
  jwtKey,
  generatePasswordHash,
  generatePasswordHashF,
  generatePasswordHashP,
  validatePassword,
  validatePasswordF,
  validatePasswordP,
  validate,
  generateTwoFactorVerification,
  twoFactorVerification,
  encrypt,
  decipher,
  cleanExpiredAuthTokens,
  cleanExpiredPasswordTokens,
  createToken,
  signUserToken,
  checkVerificationCode,
  createPasswordResetToken,
};
