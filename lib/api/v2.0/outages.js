'use strict';

const moment = require('moment-timezone');
const aguid = require('aguid');
const joi = require('joi');
const { sortBy, map, join, includes } = require('lodash/fp');
const {
  sample,
  range,
  toLower,
  random,
  flow,
  curry,
  values,
  pick,
  isUndefined,
  overEvery,
} = require('lodash');

const { registerPlugin } = require('../../util/hapi');
const validation = require('../../validation');
const { OutageTypeEnum } = require('../../enums');

/*
 * Fixtures
 */

const generateDevice = devices => devices[random(0, devices.length - 1)];

const getnerateOutages = curry((devices, id) => {
  const startTimestamp = moment().subtract(random(10, 2000), 'minutes').valueOf();
  const endTimestamp = startTimestamp + (random(100000, 2000000));
  const device = generateDevice(devices);
  const deviceMetadata = device.meta;

  return {
    id,
    startTimestamp,
    endTimestamp,
    deviceMetadata,
    aggregatedTime: (endTimestamp - startTimestamp),
    type: sample(OutageTypeEnum),
    device: device.identification,
  };
});

let outages;

/*
 * Business logic
 */

const computePagination = curry((count, page, outagesToPaginate) => {
  const total = outagesToPaginate.length;
  const pages = Math.ceil(total / count);
  const safePage = Math.min(page, pages);
  const safeCount = Math.min(count, total);

  return { count: safeCount, total, page: safePage, pages };
});

const paginateOutages = curry((count, page, outagesToPaginate) => {
  const pagination = computePagination(count, page, outagesToPaginate);
  const begin = (pagination.page - 1) * pagination.count;
  const end = begin + pagination.count;

  return outagesToPaginate.slice(begin, end);
});

const normalizeForSearch = flow(String, toLower);
const pickOutageItemSearchableProps = outageItem =>
  [outageItem.type, outageItem.device.name, outageItem.device.site.name];
const outageItemToSearchable = flow(pickOutageItemSearchableProps, map(normalizeForSearch), join(' '));

const typeSelector = curry((type, outageItem) => {
  if (isUndefined(type)) { return true }
  return outageItem.type === type;
});

const querySelector = curry((query, outageItem) => {
  if (isUndefined(query)) { return true }
  return flow(outageItemToSearchable, includes(query))(outageItem);
});

const periodSelector = curry((period, outageItem) => {
  if (isUndefined(period)) { return true }
  return Date.now() - outageItem.startTimestamp <= period;
});

const siteIdSelector = curry((siteId, outageItem) => {
  if (isUndefined(siteId)) { return true }
  // return pathEq(['site', 'id'], siteId, outageItem);
  return outageItem.site !== null; // replace with previous line in production code.
});

const filterOutages = curry(({ siteId, period, query }, outagesToFilter) => {
  const selector = overEvery(
    siteIdSelector(siteId),
    periodSelector(period),
    querySelector(query)
  );

  return outagesToFilter.filter(selector);
});

const computeAggregation = outagesToAggregate => ({
  allCount: outagesToAggregate.length,
  outageCount: outagesToAggregate.filter(typeSelector(OutageTypeEnum.Outage)).length,
  qualityCount: outagesToAggregate.filter(typeSelector(OutageTypeEnum.Quality)).length,
});


/*
 * Route definitions
 */

function register(server) {
  const { devices } = server.plugins.fixtures.devices;
  outages = flow(range, map(aguid), map(getnerateOutages(devices)), sortBy(['startTimestamp']))(1, 150);

  server.route({
    method: 'GET',
    path: '/v2.0/outages',
    config: {
      validate: {
        query: {
          count: joi.number().min(1).required(),
          page: joi.number().min(1).required(),
          siteId: validation.siteId.optional(),
          deviceId: joi.string().optional(),
          type: joi.string().valid(...values(OutageTypeEnum)).optional(),
          period: validation.outagesPeriod,
          query: joi.string().min(1).optional(),
        },
      },
    },
    handler(request, reply) {
      const { count, page } = request.query;
      const filters = pick(request.query, 'type', 'period', 'siteId', 'query');
      const partiallyFilteredOutages = filterOutages(filters, outages); // filtered by all criteria except type.
      const filteredOutages = partiallyFilteredOutages.filter(typeSelector(filters.type));
      const paginatedOutages = paginateOutages(count, page, filteredOutages);


      reply({
        pagination: computePagination(count, page, filteredOutages),
        aggregation: computeAggregation(partiallyFilteredOutages),
        items: paginatedOutages,
      });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/outages/unread',
    config: {
      validate: {
        query: {
          timestamp: joi.date().timestamp('javascript').required(),
        },
      },
    },
    handler(request, reply) {
      // filter outages younger than timestamp and count them.
      reply({ count: 2 });
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'outages_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
