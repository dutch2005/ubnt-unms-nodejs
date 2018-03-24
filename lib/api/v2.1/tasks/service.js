'use strict';

const aguid = require('aguid');
const { map, pick, sumBy, defaultTo, partialRight, isUndefined, getOr, find, flow } = require('lodash/fp');
const { Reader: reader } = require('monet');
const { chain } = require('ramda');
const { cata } = require('ramda-adjunct');

const { getPagingByQuery, allP, findOr, rejectP, resolveP } = require('../../../util');
const { TaskStatusEnum } = require('../../../enums');
const { fromDb: deviceFromDb } = require('../../../transformers/device');
const { fromDbList: taskFromDbList, toApiList: taskToApiList } = require('../../../transformers/task');
const { fromDbList: taskBatchFromDbList, toApiList: taskBatchToApiList } = require('../../../transformers/taskBatch');

/**
 * @param {string} userId
 * @param {string} type
 * @param {Array.<Object>} payloads
 * @return {!Reader.<startTasks~callback>}
 */
const startTasks = (userId, type, payloads) => reader(
  /**
   * @function startTasks~callback
   * @param {DbDal} dal
   * @param {FirmwareDal} firmwareDal
   * @param {Tasks} tasks
   * @param {DB} DB
   * @return {!Promise.<DbTask[]>}
   */
  ({ dal, firmwareDal, tasks, DB }) => {
    const batchId = aguid();

    const taskListPromises = payloads.map(({ deviceId, firmwareId }) => DB.device.findById(deviceId)
      .then(deviceFromDb({ firmwareDal }))
      .then(cata(rejectP, resolveP))
      .then(cmDevice => dal.taskRepository.save({
        id: aguid(),
        batchId,
        userId,
        type,
        payload: { device: cmDevice, firmware: firmwareDal.findById(firmwareId) },
      }))
      .then(tasks.enqueueTask)
    );

    return allP(taskListPromises);
  }
);

/**
 * @param {number} [count]
 * @param {number} [page]
 * @param {string} [status]
 * @param {number} [period]
 * @return {!Reader.<listTaskBatches~callback>}
 */
const listTaskBatches = ({ count, page = 1, status, period }) => reader(
  /**
   * @function listTaskBatches~callback
   * @param {DbDal} dal
   * @return {!Promise.<DbTaskBatch[]>}
   */
  ({ dal }) => {
    const { limit, offset } = getPagingByQuery({ count, page });

    const aggregationsPromise = dal.taskBatchRepository.findAggs(period);
    const listPromise = dal.taskBatchRepository.findAll({ offset, limit, status, period });
    return Promise.all([aggregationsPromise, listPromise])
      .then(([aggregation, list]) => {
        const total = isUndefined(status)
          ? defaultTo(0, sumBy('count', aggregation))
          : flow(find(['status', status]), getOr(0, ['count']))(aggregation);

        return listTaskBatches.toApiModel({ aggregation, count, total, page }, list);
      }
      );
  }
);

listTaskBatches.toApiModel = (auxiliaries, dbTaskBatchList) => taskBatchFromDbList(auxiliaries, dbTaskBatchList)
  .flatMap(taskBatchToApiList)
  .cata(rejectP, resolveP);

/**
 * @param {string} userId
 * @param {string} batchId
 * @return {!Reader.<cancelTaskBatch~callback>}
 */
const cancelTaskBatch = (userId, batchId) => reader(
  /**
   * @function cancelTaskBatch~callback
   * @param {DbDal} dal
   * @param {Tasks} tasks
   * @return {!Promise.<DbTask[]>}
   */
  ({ dal, tasks }) => dal.taskRepository
    .findAll({ where: { batchId } })
    .then(map(partialRight(tasks.cancelTask, [userId])))
    .then(allP)
);

/**
 * @param {string} batchId
 * @return {!Reader.<listTasks~callback>}
 */
const listTasks = batchId => reader(
  /**
   * @function listTasks~callback
   * @param {DbDal} dal
   * @return {!Promise.<DbTaskBatch[]>}
   */
  ({ dal }) => dal.taskRepository.findAll({ where: { batchId } })
    .then(taskFromDbList({}))
    .then(chain(taskToApiList))
    .then(cata(rejectP, resolveP))
);

/**
 * @return {!Reader.<batchesInProgress~callback>}
 */
const batchesInProgress = () => reader(
  /**
   * @function batchesInProgress~callback
   * @param {DbDal} dal
   * @return {!Promise.<{ count: number }>}
   */
  ({ dal }) => dal.taskBatchRepository.findAggs()
    .then(findOr({ count: 0 }, aggregation => aggregation.status === TaskStatusEnum.InProgress))
    .then(pick('count'))
);


module.exports = {
  listTaskBatches,
  cancelTaskBatch,
  batchesInProgress,
  listTasks,
  startTasks,
};
