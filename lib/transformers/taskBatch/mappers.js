'use strict';

const { liftMapper } = require('../index');
const { TaskStatusEnum } = require('../../enums');

/**
 * @typedef {Object} ApiTaskBatch
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
 * @property {TaskStatusEnum|string} status
 * @property {number} progress
 * @property {number} startTimestamp
 * @property {number} endTimestamp
 */

/**
 * @typedef {Object} ApiTaskBatchList
 * @property {Object} pagination
 * @property {number} pagination.count - number of batches in list
 * @property {number} pagination.total - total number of batches
 * @property {number} pagination.page - the number of page
 * @property {number} pagination.pages - total number of pages available
 * @property {Object<string, number>} aggregation
 * @property {ApiTaskBatch[]} items
 */

/**
 * @signature
 * toApi :: CorrespondenceTaskBatch -> ApiTaskBatch
 *    CorrespondenceTask = Object
 *    ApiTaskBatch = Object
 *
 * @param {CorrespondenceTaskBatch} correspondenceData
 * @return {ApiTaskBatch}
 */
const toApi = correspondenceData => ({
  identification: {
    id: correspondenceData.identification.id,
    type: correspondenceData.identification.type,
  },
  tasks: {
    total: correspondenceData.tasks.total,
    successful: correspondenceData.tasks.successful,
    failed: correspondenceData.tasks.failed,
    canceled: correspondenceData.tasks.canceled,
    inProgress: correspondenceData.tasks.inProgress,
    queued: correspondenceData.tasks.queued,
  },
  status: correspondenceData.status,
  progress: correspondenceData.progress,
  startTimestamp: correspondenceData.startTimestamp,
  endTimestamp: correspondenceData.endTimestamp,
});

/**
 * @signature
 * toApiList :: CorrespondenceTaskBatchList -> ApiTaskBatchList
 *    CorrespondenceTaskBatchList = Object
 *    ApiTaskBatchList = Object
 *
 * @function toApiList
 * @param {CorrespondenceTaskBatchList} correspondenceData
 * @return {ApiTaskBatchList}
 */
const toApiList = correspondenceData => ({
  pagination: {
    count: correspondenceData.pagination.count,
    total: correspondenceData.pagination.total,
    page: correspondenceData.pagination.page,
    pages: correspondenceData.pagination.pages,
  },
  aggregation: {
    [TaskStatusEnum.Queued]: correspondenceData.aggregation[TaskStatusEnum.Queued],
    [TaskStatusEnum.InProgress]: correspondenceData.aggregation[TaskStatusEnum.InProgress],
    [TaskStatusEnum.Success]: correspondenceData.aggregation[TaskStatusEnum.Success],
    [TaskStatusEnum.Failed]: correspondenceData.aggregation[TaskStatusEnum.Failed],
    [TaskStatusEnum.Canceled]: correspondenceData.aggregation[TaskStatusEnum.Canceled],
  },
  items: correspondenceData.items.map(toApi),
});

module.exports = {
  toApi,
  toApiList,

  safeToApi: liftMapper(toApi),
  safeToApiList: liftMapper(toApiList),
};
