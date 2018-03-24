'use strict';

const joi = require('joi');
const aguid = require('aguid');
const { Chance } = require('chance');
const { orderBy, map, join, includes, toUpper } = require('lodash/fp');
const {
  sample, sampleSize, range, toLower, random, flow, curry, values, pick, isUndefined, overEvery,
} = require('lodash');

const { registerPlugin } = require('../../util/hapi');
const validation = require('../../validation');
const { LogLevelEnum, LogTagEnum } = require('../../enums');

// chance generator instance.
const chance = new Chance();

let logs;

/*
 * Fixtures
 */

const pickRandomDevice = (level, devices) => {
  if (level !== LogLevelEnum.Info) {
    return devices[random(0, devices.length - 1)].identification;
  }
  return null;
};

const generateLogMessage = (level, device) => {
  switch (level) {
    case LogLevelEnum.Error: return sample([
      `${toUpper(device.type)}: ${device.name} has been disconnected for over 30 seconds. ` +
        `Last known state: [CPU: ${random(0, 100)}'%, RAM: '${random(0, 100)}%].`,
      `${toUpper(device.type)}: ${device.name} connected back to UNMS.`,
    ]);
    case LogLevelEnum.Info: return sample([
      `USER: ubnt log in from ${chance.ip()}.`,
    ]);
    case LogLevelEnum.Warning: return sample([
      `CPU on device ${device.name} has been over 90% for over 30 seconds.`,
      `RAM on device ${device.name} has been over 90% for over 10 seconds.`,
    ]);
    default: return '';
  }
};

const generateLogItem = curry((devices, logItemId) => {
  const level = sample(LogLevelEnum);
  const device = pickRandomDevice(level, devices);
  const site = device ? device.site : null;

  return {
    id: logItemId,
    timestamp: (Date.now() - random(10, 1000000000)),
    message: generateLogMessage(level, device),
    level,
    tags: sampleSize(LogTagEnum, 3),
    device,
    site,
  };
});

const generateLogItems = (rangeStart, rangeEnd, devices) => (flow(
  range,
  map(aguid),
  map(generateLogItem(devices)),
  orderBy(['timestamp'], ['desc'])
)(rangeStart, rangeEnd));

/*
 * Business logic
 */

const computePagination = curry((count, page, logsToPaginate) => {
  const total = logsToPaginate.length;
  const pages = Math.ceil(total / count);
  const safePage = Math.min(page, pages);
  const safeCount = Math.min(count, total);

  return { count: safeCount, total, page: safePage, pages };
});

const paginateLogs = curry((count, page, logsToPaginate) => {
  const pagination = computePagination(count, page, logsToPaginate);
  const begin = (pagination.page - 1) * pagination.count;
  const end = begin + pagination.count;

  return logsToPaginate.slice(begin, end);
});

const normalizeForSearch = flow(String, toLower);
const pickLogItemSearchableProps = logItem => [logItem.level, logItem.message, join(' ', logItem.tags)];
const logItemToSearchable = flow(pickLogItemSearchableProps, map(normalizeForSearch), join(' '));

const levelSelector = curry((level, logItem) => {
  if (isUndefined(level)) { return true }
  return logItem.level === level;
});

const querySelector = curry((query, logItem) => {
  if (isUndefined(query)) { return true }
  return flow(logItemToSearchable, includes(query))(logItem);
});

const periodSelector = curry((period, logItem) => {
  if (isUndefined(period)) { return true }
  return Date.now() - logItem.timestamp <= period;
});

const siteIdSelector = curry((siteId, logItem) => {
  if (isUndefined(siteId)) { return true }
  // return pathEq(['site', 'id'], siteId, logItem);
  return logItem.site !== null; // replace with previous line in production code.
});

const filterLogs = curry(({ siteId, period, query }, logsToFilter) => {
  const selector = overEvery(
    siteIdSelector(siteId),
    periodSelector(period),
    querySelector(query)
  );

  return logsToFilter.filter(selector);
});

const computeAggregation = logsToAggregate => ({
  allCount: logsToAggregate.length,
  infoCount: logsToAggregate.filter(levelSelector(LogLevelEnum.Info)).length,
  warningCount: logsToAggregate.filter(levelSelector(LogLevelEnum.Warning)).length,
  errorCount: logsToAggregate.filter(levelSelector(LogLevelEnum.Error)).length,
});


/*
 * Route definitions
 */

function register(server) {
  const { devices } = server.plugins.fixtures.devices;
  logs = generateLogItems(3000, 4000, devices);

  server.route({
    method: 'GET',
    path: '/v2.0/logs',
    config: {
      validate: {
        query: {
          count: joi.number().min(1).required(),
          page: joi.number().min(1).required(),
          siteId: validation.siteId.optional(),
          deviceId: joi.string().optional(),
          level: joi.string().valid(...values(LogLevelEnum)).optional(),
          period: validation.logsPeriod,
          query: joi.string().min(1).optional(),
        },
      },
    },
    handler(request, reply) {
      const { count, page } = request.query;
      const filters = pick(request.query, 'level', 'period', 'siteId', 'query');
      const partiallyFilteredLogs = filterLogs(filters, logs); // filtered by all criteria except level.
      const filteredLogs = partiallyFilteredLogs.filter(levelSelector(filters.level));
      const paginatedLogs = paginateLogs(count, page, filteredLogs);

      reply({
        pagination: computePagination(count, page, filteredLogs),
        aggregation: computeAggregation(partiallyFilteredLogs),
        items: paginatedLogs,
      });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/logs/unread',
    config: {
      validate: {
        query: {
          timestamp: joi.date().timestamp('javascript').required(),
          level: joi.array().items(joi.string().valid(...values(LogLevelEnum))).single(true),
        },
      },
    },
    handler(request, reply) {
      // filter logs younger than timestamp and count them.
      reply({ count: 10 });
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'logs_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
