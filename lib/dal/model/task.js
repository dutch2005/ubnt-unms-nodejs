'use strict';

const { values } = require('lodash/fp');

const { TaskTypeEnum, TaskStatusEnum } = require('../../enums');
const { functorTrait } = require('../utils');

/**
 * Task
 *
 * @typedef {Object} DbTask
 * @property {string} id UUID
 * @property {string} batchId UUID
 * @property {string} userId UUID
 * @property {TaskTypeEnum} type
 * @property {?Object} payload
 * @property {number} progress
 * @property {?Date} startTime
 * @property {?Date} endTime
 * @property {ProgressStatusEnum} status
 * @property {?string} error
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const taskModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    batchId: {
      type: DataTypes.UUID,
      field: 'batch_id',
      allowNull: false, // required
    },
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
      allowNull: false, // required
    },
    type: {
      type: DataTypes.ENUM,
      values: values(TaskTypeEnum),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
    },
    progress: {
      type: DataTypes.REAL,
    },
    startTime: {
      type: DataTypes.DATE,
      field: 'start_time',
    },
    endTime: {
      type: DataTypes.DATE,
      field: 'end_time',
    },
    status: {
      type: DataTypes.ENUM,
      values: values(TaskStatusEnum),
      allowNull: false,
    },
    error: {
      type: DataTypes.STRING,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.taskModel)),
    tableName: 'task',
  };

  return sequelize.define('taskModel', taskModel, config);
};
/* eslint-enable new cap */
