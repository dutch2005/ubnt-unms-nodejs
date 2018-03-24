'use strict';

const joi = require('joi');
const aguid = require('aguid');
const semver = require('semver');
const moment = require('moment-timezone');
const {
  range, values, curry, getOr, isUndefined, flow, cond, times, groupBy, mapValues, gt, constant, minBy, maxBy, __, T,
  sum,
} = require('lodash/fp');
const { propEq, pathEq, find, assoc, when, length, applySpec, pathSatisfies } = require('ramda');
const Chance = require('chance');

const { registerPlugin } = require('../../util/hapi');
const { TaskStatusEnum, TaskTypeEnum } = require('../../enums');
const { toMs } = require('../../util');
const validation = require('../../validation');

const chance = new Chance();
const META = Symbol.for('meta');

const TASK_TYPES = values(TaskTypeEnum);
const TASK_STATUSES = values(TaskStatusEnum);

const MAX_TASK_DURATION = toMs('hours', 2);

const DATE_MIN = moment().subtract(1, 'month').valueOf();
const DATE_MAX = moment().valueOf();

/*
 * Business logic
 */
const computePagination = (count, page, list) => {
  const total = list.length;
  const pages = Math.ceil(total / count);
  const safePage = Math.min(page, pages);
  const safeCount = Math.min(count, total);
  return { count: safeCount, total, page: safePage, pages };
};

const paginate = (count, page, list) => {
  const pagination = computePagination(count, page, list);
  const begin = (pagination.page - 1) * pagination.count;
  const end = begin + pagination.count;

  return list.slice(begin, end);
};

const filterByStatus = curry((status, taskItem) => {
  if (isUndefined(status)) { return true }
  return taskItem.status === status;
});

const filterByPeriod = curry((period, taskItem) => {
  if (isUndefined(period) || taskItem.startTimestamp === null) { return true }
  return Date.now() - taskItem.startTimestamp <= period;
});

const computeAggregation = flow(
  groupBy('status'),
  mapValues(length),
  applySpec({
    [TaskStatusEnum.Queued]: getOr(0, TaskStatusEnum.Queued),
    [TaskStatusEnum.InProgress]: getOr(0, TaskStatusEnum.InProgress),
    [TaskStatusEnum.Success]: getOr(0, TaskStatusEnum.Success),
    [TaskStatusEnum.Failed]: getOr(0, TaskStatusEnum.Failed),
    [TaskStatusEnum.Canceled]: getOr(0, TaskStatusEnum.Canceled),
  })
);

const computeBatchStatus = cond([
  [pathSatisfies(gt(__, 0), [TaskStatusEnum.InProgress]), constant(TaskStatusEnum.InProgress)],
  [pathSatisfies(gt(__, 0), [TaskStatusEnum.Canceled]), constant(TaskStatusEnum.Canceled)],
  [pathSatisfies(gt(__, 0), [TaskStatusEnum.Queued]), constant(TaskStatusEnum.Queued)],
  [pathSatisfies(gt(__, 0), [TaskStatusEnum.Failed]), constant(TaskStatusEnum.Failed)],
  [T, constant(TaskStatusEnum.Success)],
]);

/*
 * Fixtures
 */
const generateGenericTask = (type, batchId, { timeStart, timeEnd }) => {
  const task = {
    identification: {
      id: aguid(),
      batchId,
      type,
    },
    progress: 0,
    startTimestamp: null,
    endTimestamp: null,
    status: chance.pickone(TASK_STATUSES),
    error: null,
  };

  if (task.status === TaskStatusEnum.InProgress) {
    task.startTimestamp = chance.natural({ min: timeStart, max: timeEnd });
    task.progress = chance.floating({ min: 0, max: 0.999 });
  } else if (task.status !== TaskStatusEnum.Queued) {
    task.startTimestamp = chance.natural({ min: timeStart, max: timeEnd });
    task.endTimestamp = chance.natural({ min: task.startTimestamp, max: timeEnd });
  }

  return task;
};

const generateFirmwareUpgradeTaskOverview = ({ devices }) => {
  const device = chance.pickone(devices);
  const firmwareSemver = semver.parse(device.firmware.current)
    .inc(chance.pickone(['major', 'minor', 'patch']));

  return {
    device: {
      id: device.identification.id,
      model: device.identification.model,
      type: device.identification.type,
      name: device.identification.name,
    },
    from: {
      semver: (() => {
        if (device.firmware.semver === null) { return null }
        return {
          major: device.firmware.semver.current.major,
          minor: device.firmware.semver.current.minor,
          patch: device.firmware.semver.current.patch,
          prerelease: device.firmware.semver.current.prerelease,
        };
      })(),
    },
    to: {
      semver: {
        major: firmwareSemver.major,
        minor: firmwareSemver.minor,
        patch: firmwareSemver.patch,
        prerelease: firmwareSemver.prerelease,
      },
    },
  };
};

const generateTask = (type, batchId, { timeStart, timeEnd }, auxiliaries) => {
  const task = generateGenericTask(type, batchId, { timeStart, timeEnd });
  switch (type) {
    case TaskTypeEnum.FirmwareUpgrade:
      task.overview = generateFirmwareUpgradeTaskOverview(auxiliaries);
      break;
    default:
      task.overview = {};
  }

  return task;
};

const generateTaskBatch = curry((auxiliaries, batchId) => {
  const type = chance.pickone(TASK_TYPES);
  const timeStart = chance.natural({ min: DATE_MIN, max: DATE_MAX - MAX_TASK_DURATION });
  const timeEnd = chance.natural({ min: timeStart, max: timeStart + MAX_TASK_DURATION });

  const tasks = times(
    () => generateTask(type, batchId, { timeStart, timeEnd }, auxiliaries),
    chance.natural({ min: 1, max: 20 })
  );

  const aggregation = computeAggregation(tasks);
  const status = computeBatchStatus(aggregation);
  const startTimestamp = getOr(null, 'startTimestamp', minBy('startTimestamp', tasks));
  const endTimestamp = getOr(null, 'endTimestamp', maxBy('endTimestamp', tasks));
  const tasksOverview = {
    total: sum(values(aggregation)),
    successful: aggregation[TaskStatusEnum.Success],
    failed: aggregation[TaskStatusEnum.Failed],
    canceled: aggregation[TaskStatusEnum.Canceled],
    inProgress: aggregation[TaskStatusEnum.InProgress],
    queued: aggregation[TaskStatusEnum.Queued],
  };

  return {
    [META]: tasks,
    identification: {
      id: batchId,
      type,
    },
    tasks: tasksOverview,
    status,
    startTimestamp,
    endTimestamp,
  };
});

const generateTaskBatches = createNewTaskBatch => range(1000, 1500)
  .map(aguid)
  .map(createNewTaskBatch)
  .sort((a, b) => a.createdAt - b.createdAt);

/*
 * Route definitions
 */
function register(server) {
  const { devices } = server.plugins.fixtures.devices;

  const createNewTaskBatch = generateTaskBatch({ devices });
  const taskBatches = generateTaskBatches(createNewTaskBatch);

  server.route({
    method: 'GET',
    path: '/v2.0/tasks',
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
      const { count, page, period, status } = request.query;

      const taskBatchesByPeriod = taskBatches.filter(filterByPeriod(period));
      const visibleTaskBatches = taskBatchesByPeriod.filter(filterByStatus(status));
      const paginatedTaskBatches = paginate(count, page, visibleTaskBatches);

      reply({
        pagination: computePagination(count, page, visibleTaskBatches),
        aggregation: computeAggregation(taskBatchesByPeriod),
        items: paginatedTaskBatches,
      });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/tasks',
    config: {
      validate: {
        payload: validation.newTask,
      },
    },
    handler(request, reply) {
      const newTask = createNewTaskBatch(aguid());
      taskBatches.push(newTask);

      reply(newTask);
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/tasks/{batchId}',
    config: {
      validate: {
        params: {
          batchId: validation.taskBatchId.required(),
        },
      },
    },
    handler(request, reply) {
      const taskBatch = find(pathEq(['identification', 'id'], request.params.batchId), taskBatches);

      reply(taskBatch[META]);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/tasks/{batchId}/cancel',
    config: {
      validate: {
        params: {
          batchId: validation.taskBatchId.required(),
        },
      },
    },
    handler(request, reply) {
      const taskBatch = find(pathEq(['identification', 'id'], request.params.batchId), taskBatches);
      taskBatch.status = TaskStatusEnum.Canceled;
      taskBatch[META] = taskBatch[META]
        .map(when(propEq('status', TaskStatusEnum.InProgress), assoc('status', TaskStatusEnum.Canceled)));

      reply({ result: true, message: 'Task canceled' });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/tasks/in-progress',
    handler(request, reply) {
      reply({ count: taskBatches.filter(propEq('status', TaskStatusEnum.InProgress)).length });
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'task_manager_v2.0',
  version: '1.0.0',
  dependencies: ['devices_v2.0', 'fixtures'],
};
