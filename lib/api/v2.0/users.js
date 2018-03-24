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

/*
 * Route definitions
 */

function register(server) {
  server.route({
    method: 'GET',
    path: '/v2.0/users',
    handler(request, reply) {
      reply([user]);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/users',
    config: {
      validate: {
        payload: {
          username: Validation.username,
          email: Joi.string().email().required(),
          password: Validation.password,
        },
      },
    },
    handler(request, reply) {
      reply(user);
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/users/{id}',
    config: {
      validate: {
        params: {
          id: Validation.userId,
        },
        payload: { // support for changing password not implemented yet.
          id: Validation.userId,
          username: Validation.username,
          email: Joi.string().email().required(),
          alerts: Joi.boolean().required(),
        },
      },
    },
    handler(request, reply) {
      reply(user);
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/users/{id}',
    config: {
      validate: {
        params: {
          id: Validation.userId,
        },
      },
    },
    handler(request, reply) {
      reply({
        result: true,
        message: '0 user(s) deleted',
      });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/users/{id}/reinvite',
    config: {
      validate: {
        params: {
          id: Validation.userId,
        },
      },
    },
    handler(request, reply) {
      reply({
        result: true,
        message: 'User reinvited',
      });
    },
  });
}


/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'users_v2.0',
  version: '1.0.0',
};
