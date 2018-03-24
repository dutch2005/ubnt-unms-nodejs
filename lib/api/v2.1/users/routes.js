'use strict';

const Boom = require('boom');
const joi = require('joi');
const { values } = require('ramda');

const validation = require('../../../validation');
const { UserRoleEnum } = require('../../../enums');

const { toApiUser, toApiUsers } = require('../../../transformers/user');

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/users',
    handler(request, reply) {
      reply(
        service
          .getUsers()
          .chainEither(toApiUsers)
          .promise()
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/users',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: {
          username: validation.username,
          email: joi.string().email().required(),
          password: validation.password,
          role: joi.string().valid(...values(UserRoleEnum)).required(),
        },
      },
    },
    handler(request, reply) {
      const { payload } = request;

      reply(
        service
          .createUser(payload)
          .chainEither(toApiUser)
          .promise()
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/users/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.userId,
        },
        payload: { // support for changing password not implemented yet.
          id: validation.userId,
          username: validation.username,
          email: joi.string().email().required(),
          alerts: joi.boolean().required(),
          role: joi.string().valid(...values(UserRoleEnum)).required(),
        },
      },
    },
    handler(request, reply) {
      const { payload, params: { id: userId } } = request;

      reply(
        service
          .updateUser(userId, payload)
          .chainEither(toApiUser)
          .promise()
      );
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.1/users/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.userId,
        },
      },
    },
    handler(request, reply) {
      const { params: { id: userId } } = request;

      if (userId === request.token.userId) {
        reply(
          Boom.notAcceptable('cannot delete own account')
        );
      } else {
        reply(
          service
            .deleteUser(userId)
            .promise()
        );
      }
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/users/{id}/reinvite',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.userId,
        },
      },
    },
    handler(request, reply) {
      const { params: { id: userId } } = request;

      reply(
        service
          .reinviteUser(userId)
          .promise()
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
