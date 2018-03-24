'use strict';

const { values } = require('lodash/fp');
const joi = require('joi');

const { TaskStatusEnum } = require('../../../enums');
const validation = require('../../../validation');

/*
 * Route definitions
 */
function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/tasks',
    config: {
      validate: {
        query: joi.object().keys({
          count: joi.number().min(1).required(),
          page: joi.number().min(1).required(),
          status: joi.string().valid(values(TaskStatusEnum)),
          period: joi.number().positive(),
        }),
      },
    },
    handler(request, reply) {
      reply(
        service.listTaskBatches(request.query)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/tasks',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: validation.newTask,
      },
    },
    handler(request, reply) {
      const { type, payload } = request.payload;
      const { userId } = request.token;
      reply(
        service.startTasks(userId, type, payload)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/tasks/{batchId}',
    config: {
      validate: {
        params: {
          batchId: validation.taskBatchId.required(),
        },
      },
    },
    handler(request, reply) {
      reply(
        service.listTasks(request.params.batchId)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/tasks/{batchId}/cancel',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          batchId: validation.taskBatchId.required(),
        },
      },
    },
    handler(request, reply) {
      const { userId } = request.token;
      reply(
        service.cancelTaskBatch(userId, request.params.batchId)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/tasks/in-progress',
    handler(request, reply) {
      reply(
        service.batchesInProgress()
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
