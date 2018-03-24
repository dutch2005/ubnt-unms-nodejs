'use strict';

/*
 * Hapijs routes definition
 */

const { omit } = require('lodash/fp');
const { values, merge, objOf } = require('ramda');

const validation = require('../../../validation');
const joi = require('joi');
const { LogLevelEnum } = require('../../../enums');


function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/logs',
    config: {
      validate: {
        query: joi.object().keys({
          count: joi.number().min(1).required(),
          page: joi.number().min(1).required(),
          siteId: joi.string().guid(),
          deviceId: joi.string().guid(),
          level: joi.string().valid(values(LogLevelEnum)),
          period: validation.logsPeriod,
          query: joi.string().min(1),
        }),
      },
      pre: [server.methods.toBackendPaginationPrerequisite()],
    },
    handler(request, reply) {
      const logsParams = merge(request.query, request.pre.pagination);
      const aggsParams = omit(['level'], request.query);

      reply(
        service.logItemList(logsParams, aggsParams)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/logs/unread',
    config: {
      validate: {
        query: {
          timestamp: joi.date().timestamp('javascript').raw().required(),
          level: joi.array().items(joi.string().valid(...values(LogLevelEnum))),
        },
      },
    },
    handler(request, reply) {
      reply(
        service.countUnread(request.query).then(objOf('count'))
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
