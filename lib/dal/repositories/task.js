'use strict';

const { Reader: reader } = require('monet');
const { isUndefined } = require('lodash/fp');
const { Sequelize } = require('sequelize');

const { buildWhereQuery, single, singleOrDefault } = require('../utils');
const { TaskStatusEnum } = require('../../enums');

const { QueryTypes } = Sequelize;

/*
 * Generic accessors
 */

/**
 * @name DbTaskRepository~findOne
 * @param {?Object} [where]
 * @return {Promise.<DbTask>}
 */
const findOne = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM task
     ${buildWhereQuery(config, where, { model: config.models.taskModel })}
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.taskModel,
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbTaskRepository~findAll
 * @param {Object} [where]
 * @return {Promise.<DbTask[]>}
 */
const findAll = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM task
     ${buildWhereQuery(config, where, { model: config.models.taskModel })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.taskModel,
      mapToModel: true,
    }
  )
);

/**
 * @name DbTaskRepository~save
 * @param {string} id
 * @param {string} batchId
 * @param {string} userId
 * @param {TaskTypeEnum|string} type
 * @param {*} [payload]
 * @param {number} [progress]
 * @param {?Date} [startTime]
 * @param {?Date} [endTime]
 * @param {ProgressStatusEnum|string} [status]
 * @param {?string} [error]
 * @return {Promise.<DbTask>}
 */
const save = ({
    id,
    batchId,
    userId,
    type,
    payload,
    progress = 0,
    startTime = null,
    endTime = null,
    status = TaskStatusEnum.Queued,
    error = null,
  }) => reader(
  config => config.query(
    `INSERT INTO task (
        id, batch_id, user_id, type, payload, progress, start_time, end_time, status, error
     ) VALUES (
        $id, $batchId, $userId, $type, $payload, $progress, $startTime, $endTime, $status, $error
     )
     RETURNING *
      `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.taskModel,
      bind: { id, batchId, userId, type, payload, progress, startTime, endTime, status, error },
      mapToModel: true,
    }
  ).then(single)
);

/**
 * @name DbTaskRepository~update
 * @param {string} id
 * @param {?string} [batchId]
 * @param {?TaskTypeEnum} [type]
 * @param {?number} [progress]
 * @param {?Date} [startTime]
 * @param {?Date} [endTime]
 * @param {?ProgressStatusEnum|string} [status]
 * @param {?string} [error]
 * @return {Promise.<DbTask>}
 */
const update = ({ id, batchId, type, progress, startTime, endTime, status, error }) => reader(
  config => config.query(
    `UPDATE task 
     SET ${isUndefined(type) ? '' : 'type = $type,'}
         ${isUndefined(progress) ? '' : 'progress = $progress,'}
         ${isUndefined(startTime) ? '' : 'start_time = $startTime,'}
         ${isUndefined(endTime) ? '' : 'end_time = $endTime,'} 
         ${isUndefined(status) ? '' : 'status = $status,'}
         ${isUndefined(error) ? '' : 'error = $error,'}
         updated_at = NOW()
     WHERE id = $id
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.taskModel,
      bind: { id, batchId, type, progress, startTime, endTime, status, error },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @alias DbTaskRepository
 */
module.exports = {
  findOne,
  findAll,
  save,
  update,
};
