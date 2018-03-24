'use strict';

/*
 * Hapijs routes definition
 */


const joi = require('joi');
const { values, merge, objOf } = require('ramda');
const { omit } = require('lodash/fp');

const validation = require('../../../validation');
const { OutageTypeEnum } = require('../../../enums');
const { ErrorSchema, PaginationSchema, SiteIdentificationSchema, DeviceSchema, AuthHeaderSchema } = require('../osm');

/*
 * Route definitions
 */


function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/outages',
    config: {
      description: 'List of all network outages for last month',
      tags: ['api', 'outage'],
      validate: {
        query: {
          count: joi.number().min(1).required(),
          page: joi.number().min(1).required(),
          siteId: validation.siteId.optional(),
          deviceId: validation.deviceId.optional(),
          type: joi.string().valid(...values(OutageTypeEnum)).optional(),
          period: joi.number().min(3600).optional(),
          query: joi.string().min(1).optional(),
        },
        headers: AuthHeaderSchema,
      },
      response: {
        failAction: 'log',
        sample: 0,
        status: {
          200: joi.object({
            pagination: PaginationSchema,
            aggregation: joi.object({
              allCount: joi.number(),
              outageCount: joi.number(),
              qualityCount: joi.number(),
            }),
            items: joi.array().items(joi.object({
              id: joi.string().guid().required(),
              startTimestamp: joi.string().required(),
              endTimestamp: joi.string().required(),
              type: joi.string().valid(...values(OutageTypeEnum)),
              aggregatedTime: joi.number().min(1).required(),
              site: SiteIdentificationSchema,
              device: DeviceSchema,
            })),
          }),
          401: ErrorSchema,
          500: ErrorSchema,
        },
      },
      pre: [server.methods.toBackendPaginationPrerequisite()],
    },
    handler(request, reply) {
      const outagesParams = merge(request.query, request.pre.pagination);
      const aggsParams = omit(['type'], request.query);

      reply(
        service.outageItemList(outagesParams, aggsParams)
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/outages/unread',
    config: {
      validate: {
        query: {
          timestamp: joi.date().timestamp('javascript').raw().required(),
        },
      },
    },
    handler(request, reply) {
      const { timestamp } = request.query;

      reply(
        service.countUnread({ timestamp }).then(objOf('count'))
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
