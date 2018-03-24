'use strict';

const { Reader: reader } = require('monet');
const Boom = require('boom');

const { rejectP, getClientIpFromRequest } = require('../../../util');
const { toApiUser, toApiUserProfile } = require('../../../transformers/user');

function getUser(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .getUser(request.token.userId)
        .chainEither(toApiUser)
        .promise()
    );
  });
}

function putUser(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .updateUserWithAuth(request.token.userId, request.payload)
        .chainEither(toApiUser)
        .promise()
    );
  });
}

function getUserProfile(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .getUser(request.token.userId)
        .chainEither(toApiUserProfile)
        .promise()
    );
  });
}

function updateUserProfile(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .updateUserProfile(request.token.userId, request.payload)
        .chainEither(toApiUserProfile)
        .promise()
    );
  });
}

function login(request, reply) {
  return reader(({ service, eventLog, config }) => {
    const clientIp = getClientIpFromRequest(request.raw.req);

    service
      .login(request.payload)
      .promise()
      .then(([user, jwt, totpToken]) => {
        if (jwt !== null) {
          const apiUser = toApiUser(user);

          if (apiUser.isRight()) {
            eventLog.logLoginEvent(clientIp, Date.now(), apiUser.right(), null);
            return reply(apiUser.right()).header(config.jwtToken, jwt);
          }

          return rejectP(apiUser.left());
        }

        return reply(totpToken).code(201);
      })
      .catch((error) => {
        eventLog.logFailedLoginEvent(request.payload.username, clientIp);
        return reply(Boom.wrap(error));
      });
  });
}

function loginTotpAuth(request, reply) {
  return reader(({ service, eventLog, config }) => {
    const clientIp = getClientIpFromRequest(request.raw.req);

    service.loginTotp(request.payload)
      .promise()
      .then(([user, jwt]) => {
        const apiUser = toApiUser(user);

        if (apiUser.isRight()) {
          eventLog.logLoginEventTwoAuth(clientIp, Date.now(), null, null, apiUser.right());
          return reply(apiUser.right()).header(config.jwtToken, jwt);
        }

        return rejectP(apiUser.left());
      })
      .catch(reply);
  });
}

function logout(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .logout(request.token.id)
        .promise()
    );
  });
}

function getTotpAuth(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .generateTwoFactorAuthSecret(request.token.userId)
        .promise()
    );
  });
}

function setTotpAuth(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .setTotpAuth(request.token.userId, request.payload)
        .chainEither(toApiUser)
        .promise()
      );
  });
}

function requestPasswordReset(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .requestPasswordReset(request.payload.email)
        .promise()
    ).code(201);
  });
}

function resetPasswordUsingToken(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .resetPasswordUsingToken(request.payload.token, request.payload.password)
        .promise()
      );
  });
}

function checkPasswordStrength(request, reply) {
  return reader(({ service }) => {
    reply(
      service
        .checkPasswordStrength(request.payload.password)
    );
  });
}

function createMobileDevice(request, reply) {
  return reader(
    ({ service }) => reply(
      service.createMobileDevice(request.token.userId, request.payload)
    ).code(201)
  );
}


module.exports = {
  getUser,
  putUser,
  getUserProfile,
  updateUserProfile,
  login,
  loginTotpAuth,
  logout,
  getTotpAuth,
  setTotpAuth,
  requestPasswordReset,
  resetPasswordUsingToken,
  checkPasswordStrength,
  createMobileDevice,
};
