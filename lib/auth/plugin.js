'use strict';

const HapiAuthJWT2 = require('hapi-auth-jwt2');
const { weave } = require('ramda-adjunct');

const { validate, jwtKey, cleanExpiredAuthTokens, cleanExpiredPasswordTokens } = require('.');
const { jwtToken, authStrategy } = require('../../config');
const { registerPlugin } = require('../util/hapi');


function register(server) {
  const config = server.settings.app;
  const { scheduler, dal } = server.plugins;

  const validateBound = weave(validate, { dal });

  server.register(HapiAuthJWT2, () => {
    server.auth.strategy('jwt', 'jwt', {
      key: jwtKey,
      validateFunc: validateBound,
      verifyOptions: { algorithms: ['HS256'] },
      headerKey: jwtToken,
    });
    server.auth.default(authStrategy);
  });

  // register periodic tasks
  if (!config.demo) {
    scheduler.registerDailyTask(cleanExpiredAuthTokens, 'cleanExpiredAuthTokens');
    scheduler.registerDailyTask(cleanExpiredPasswordTokens, 'cleanExpiredPasswordTokens');
  }
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'auth',
  version: '1.0.0',
  dependencies: ['scheduler', 'dal'],
};

