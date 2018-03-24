'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');
const { isUndefined } = require('lodash/fp');

const { formatDateTime, buildLimitAndOffsetQuery, singleOrDefault } = require('../utils');

const { QueryTypes } = Sequelize;

const aggregations = {
  status: `
  CAST (
    CASE WHEN count(status = 'in-progress' OR NULL) > 0 THEN 'in-progress'
         WHEN count(status = 'queued' OR NULL) > 0 THEN 'queued'
         WHEN count(status = 'canceled' OR NULL) > 0 THEN 'canceled'
         WHEN count(status = 'failed' OR NULL) > 0 THEN 'failed'
         ELSE 'success'
    END as taskStatus)`,
  createdAt: 'min(created_at)',
};

const buildPeriodQuery = (config, period) => {
  if (period === null) { return '1=1' }

  const now = Date.now();
  return `${aggregations.createdAt} BETWEEN '${formatDateTime(now - period)}' AND '${formatDateTime(now)}'`;
};

const buildStatusQuery = (config, status) => {
  if (status === null) { return '1=1' }

  return `${aggregations.status} = ${config.escape(status)}`;
};

/*
 * Generic accessors
 */

/**
 * @name DbTaskBatchRepository~findById
 * @param {string} batchId
 * @return {Promise.<DbTaskBatch>}
 */
const findById = batchId => reader(
  config => config.query(
    `SELECT
        batch_id as id,
        type,
        avg(progress) as progress,
        count(*) as total_tasks,
        count(status = 'success' OR NULL) as successful_tasks,
        count(status = 'failed' OR NULL) as failed_tasks,
        count(status = 'queued' OR NULL) as queued_tasks,
        count(status = 'canceled' OR NULL) as canceled_tasks,
        count(status = 'in-progress' OR NULL) as in_progress_tasks,
        min(start_time) as start_time,
        max(end_time) as end_time,
        ${aggregations.status} as status
     FROM task
     WHERE batch_id = $batchId
     GROUP BY batch_id, type
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.taskBatchModel,
      bind: { batchId },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbTaskBatchRepository~findAll
 * @param {?number} offset
 * @param {?number} limit
 * @param {?string} [status]
 * @param {?number} [period]
 * @return {Promise.<DbTaskBatch[]>}
 */
const findAll = ({ offset, limit, status = null, period = null } = {}) => reader(
  config => config.query(
    `SELECT
        batch_id as id,
        type,
        avg(progress) as progress,
        count(*) as total_tasks,
        count(status = 'success' OR NULL) as successful_tasks,
        count(status = 'queued' OR NULL) as queued_tasks,
        count(status = 'failed' OR NULL) as failed_tasks,
        count(status = 'canceled' OR NULL) as canceled_tasks,
        count(status = 'in-progress' OR NULL) as in_progress_tasks,
        min(start_time) as start_time,
        max(end_time) as end_time,
        ${aggregations.createdAt} as created_at,
        ${aggregations.status} as status
     FROM task
     GROUP BY batch_id, type
     HAVING ${buildStatusQuery(config, status)} AND ${buildPeriodQuery(config, period)}
     ORDER BY created_at DESC
     ${buildLimitAndOffsetQuery(config, { limit, offset })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.taskBatchModel,
      mapToModel: true,
    }
  )
);

/**
 * @name DbTaskBatchRepository~findAggs
 * @param {?number} [period] - Duration in milliseconds
 * @return {Promise.<DbTaskBatchAgg[]>}
 */
const findAggs = (period = null) => reader(
  config => config.query(
    `WITH task_batch_statuses AS (
      SELECT
          batch_id as id,
          ${aggregations.status} as status
      FROM task
      GROUP BY batch_id
      HAVING ${buildPeriodQuery(config, period)}
    )
    SELECT status, count(*) as count 
    FROM task_batch_statuses
    GROUP BY status
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.taskBatchAgg,
      mapToModel: true,
    }
  )
);

/**
 * @name DbTaskBatchRepository~update
 * @param {string} batchId
 * @param {?Date} startTime
 * @param {?Date} endTime
 * @param {?ProgressStatusEnum} status
 * @param {?string} error
 * @return {Promise.<void>}
 */
const update = (batchId, { startTime, endTime, status, error }) => reader(
  config => config.query(
    `UPDATE task 
     SET ${isUndefined(startTime) ? '' : 'start_time = $startTime,'}
         ${isUndefined(endTime) ? '' : 'end_time = $endTime,'}
         ${isUndefined(status) ? '' : 'status = $status,'}
         ${isUndefined(error) ? '' : 'error = $error,'}
         updated_at = NOW()
     WHERE batchId = $batchId`,
    {
      type: QueryTypes.UPDATE,
      bind: { batchId, startTime, endTime, status, error },
    }
  ).then(singleOrDefault(null))
);

/**
 * @alias DbTaskBatchRepository
 */
module.exports = {
  findById,
  findAll,
  findAggs,
  update,
};
