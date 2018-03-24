'use strict';

const { values } = require('lodash/fp');

const { TaskTypeEnum, TaskStatusEnum } = require('../../enums');
const { functorTrait } = require('../utils');

/**
 * Task batch
 *
 * Tasks grouped by batchId.
 *
 * @typedef {Object} DbTaskBatch
 * @property {string} id UUID
 * @property {TaskTypeEnum} type
 * @property {ProgressStatusEnum} status
 * @property {number} progress
 * @property {number} totalTasks
 * @property {number} successfulTasks
 * @property {number} failedTasks
 * @property {number} canceledTasks
 * @property {number} inProgressTasks
 * @property {number} queuedTasks
 * @property {?Date} startTime
 * @property {?Date} endTime
 */

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const taskBatchModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM,
      values: values(TaskTypeEnum),
    },
    status: {
      type: DataTypes.ENUM,
      values: values(TaskStatusEnum),
    },
    progress: {
      type: DataTypes.REAL,
    },
    totalTasks: {
      type: DataTypes.INTEGER,
      field: 'total_tasks',
    },
    queuedTasks: {
      type: DataTypes.INTEGER,
      field: 'queued_tasks',
    },
    successfulTasks: {
      type: DataTypes.INTEGER,
      field: 'successful_tasks',
    },
    failedTasks: {
      type: DataTypes.INTEGER,
      field: 'failed_tasks',
    },
    canceledTasks: {
      type: DataTypes.INTEGER,
      field: 'canceled_tasks',
    },
    inProgressTasksTasks: {
      type: DataTypes.INTEGER,
      field: 'in_progress_tasks',
    },
    startTime: {
      type: DataTypes.DATE,
      field: 'start_time',
    },
    endTime: {
      type: DataTypes.DATE,
      field: 'end_time',
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.taskBatchModel)),
  };

  return sequelize.define('taskBatchModel', taskBatchModel, config);
};
/* eslint-enable new cap */
