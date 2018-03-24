'use strict';

const { map, partial, reduce, flow, invert, mapValues, constant, set } = require('lodash/fp');

const { liftParser } = require('../index');
const { TaskStatusEnum } = require('../../enums');

/**
 * @typedef {Object} CorrespondenceTaskBatch
 * @property {Object} identification
 * @property {string} identification.id
 * @property {TaskTypeEnum} identification.type
 * @property {Object} tasks
 * @property {number} tasks.total
 * @property {number} tasks.successful
 * @property {number} tasks.failed
 * @property {number} tasks.canceled
 * @property {number} tasks.inProgress
 * @property {number} tasks.queued
 * @property {string} status
 * @property {number} progress
 * @property {number} startTimestamp
 * @property {number} endTimestamp
 */

/**
 * @typedef {Object} CorrespondenceTaskBatchList
 * @property {Object} pagination
 * @property {number} pagination.count - number of batches in list
 * @property {number} pagination.total - total number of batches
 * @property {number} pagination.page - the number of page
 * @property {number} pagination.pages - total number of pages available
 * @property {Object<string, number>} aggregation
 * @property {CorrespondenceTaskBatch[]} items
 */

/**
 * @signature
 * parseDbTaskBatch :: (Object, Object) -> CorrespondenceTask
 *    CorrespondenceTask = Object
 *
 * @param {Object} auxiliaries
 * @param {DbTaskBatch} dbTaskBatch
 * @return {CorrespondenceTaskBatch}
 */
const parseDbTaskBatch = (auxiliaries, dbTaskBatch) => ({
  identification: {
    id: dbTaskBatch.id,
    type: dbTaskBatch.type,
  },
  tasks: {
    total: dbTaskBatch.totalTasks,
    successful: dbTaskBatch.successfulTasks,
    failed: dbTaskBatch.failedTasks,
    canceled: dbTaskBatch.canceledTasks,
    inProgress: dbTaskBatch.inProgressTasks,
    queued: dbTaskBatch.queuedTasks,
  },
  progress: dbTaskBatch.progress,
  status: dbTaskBatch.status,
  startTimestamp: Number(dbTaskBatch.startTime) || null,
  endTimestamp: Number(dbTaskBatch.endTime) || null,
});

/**
 * @function parseDbTaskBatchAggregation
 * @param {Array.<{ status: string, count: number }>}
 * @return {Object.<string, number>}
 */
const parseDbTaskBatchAggregation = reduce(
  (accumulator, { status, count }) => set([status], count, accumulator),
  flow(invert, mapValues(constant(0)))(TaskStatusEnum)
);

/**
 * @signature
 * parseDbTaskBatchList :: (Object, Object) -> CorrespondenceTask
 *    CorrespondenceTask = Object
 *
 * @param {Object} auxiliaries
 * @param {number} auxiliaries.count
 * @param {number} auxiliaries.page
 * @param {number} auxiliaries.total
 * @param {Array.<{ status: string, count: number }>} auxiliaries.aggregation
 * @param {DbTask[]} dbTaskList
 * @return {CorrespondenceTaskBatchList}
 */
const parseDbTaskBatchList = (auxiliaries, dbTaskList) => ({
  pagination: {
    count: auxiliaries.count,
    total: auxiliaries.total,
    page: auxiliaries.page,
    pages: Math.ceil(auxiliaries.total / auxiliaries.count),
  },
  aggregation: parseDbTaskBatchAggregation(auxiliaries.aggregation),
  items: map(partial(parseDbTaskBatch, [{}]), dbTaskList),
});

module.exports = {
  parseDbTaskBatch,
  parseDbTaskBatchList,

  safeParseDb: liftParser(parseDbTaskBatch),
  safeParseDbList: liftParser(parseDbTaskBatchList),
};
