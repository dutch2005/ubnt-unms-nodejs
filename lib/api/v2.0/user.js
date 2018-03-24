'use strict';

const Joi = require('joi');

const { registerPlugin } = require('../../util/hapi');
const Validation = require('../../validation');

const user = {
  id: '41edd11c-812e-4a36-a565-3453303649b0',
  username: 'demo',
  email: 'demo@ubnt.com',
  alerts: false,
};

const profile = {
  userId: '41edd11c-812e-4a36-a565-3453303649b0',
  presentationMode: true,
  forceChangePassword: false,
};

/*
 * Route definitions
 */

function register(server, options) {
  server.route({
    method: 'GET',
    path: '/v2.0/user',
    handler(request, reply) {
      reply(user);
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      method: 'GET',
      path: '/v2.1/user',
      handler(request, reply) {
        reply(user);
      },
    });
  }

  server.route({
    method: 'PUT',
    path: '/v2.0/user',
    config: {
      validate: {
        payload: {
          username: Validation.username,
          email: Joi.string().email().required(),
          currentPassword: Validation.password,
          newPassword: Validation.password.optional(),
        },
      },
    },
    handler(request, reply) {
      reply(user);
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/user/totpauth',
    config: {
      validate: {
        payload: {
          password: Validation.password,
          verificationCode: Joi.string(),
          totpAuthEnabled: Joi.boolean().required(),
          totpAuthSecret: Joi.string(),
        },
      },
    },
    handler(request, reply) {
      reply(Object.assign({}, user, { totpAuthEnabled: request.payload.totpAuthEnabled }));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/user/profile',
    handler(request, reply) {
      reply(profile);
    },
  });

  if (options.allowAccessWithoutLogin) {
    server.route({
      method: 'GET',
      path: '/v2.1/user/profile',
      handler(request, reply) {
        reply(profile);
      },
    });
  }

  server.route({
    method: 'PUT',
    path: '/v2.0/user/profile',
    config: {
      validate: {
        payload: {
          userId: Validation.userId,
          presentationMode: Joi.boolean().required(),
          forceChangePassword: Joi.boolean().required(),
          tableConfig: Joi.object(),
        },
      },
    },
    handler(request, reply) {
      reply(profile);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/user/login',
    config: {
      auth: false,
      validate: {
        payload: {
          username: Validation.username,
          password: Validation.password,
          sessionTimeout: Validation.sessionTimeout,
        },
      },
    },
    handler(request, reply) {
      reply({
        id: '41edd11c-812e-4a36-a565-3453303649b0',
        username: 'demo',
        email: 'demo@ubnt.com',
        alerts: false,
      });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/user/logout',
    handler(request, reply) {
      reply({
        result: true,
        message: 'Successfully logged out.',
      });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/user/password/requestreset',
    config: {
      auth: false,
      validate: {
        payload: {
          email: Joi.string().email().required(),
        },
      },
    },
    handler(request, reply) {
      reply({
        result: true,
        message: 'Reset link has been sent to provided email',
      }).code(201);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/user/password/reset',
    config: {
      auth: false,
      validate: {
        payload: {
          token: Joi.string().guid().required(),
          password: Validation.password,
        },
      },
    },
    handler(request, reply) {
      reply({
        result: true,
        message: 'Password changed',
      });
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'user_v2.0',
  version: '1.0.0',
};
