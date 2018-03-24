'use strict';

const { map, partial } = require('lodash/fp');

const { liftParser } = require('../index');
const { TaskTypeEnum } = require('../../enums');

/**
 * @typedef {Object} CorrespondenceTask
 * @property {Object} identification
 * @property {string} identification.id
 * @property {string} identification.batchId
 * @property {TaskTypeEnum} identification.type
 * @property {Object} overview
 * @property {number} progress
 * @property {number} startTimestamp
 * @property {number} endTimestamp
 * @property {TaskStatusEnum} status
 * @property {string} error
 */

/**
 * Parse task detail structure based on the task type
 *
 * @signature parseTaskOverview :: (Object, Object) -> Object
 * @param {Object} auxiliaries
 * @param {DbTask} dbTask
 * @return {*}
 */
const parseTaskOverview = (auxiliaries, dbTask) => {
  const payload = dbTask.payload;
  switch (dbTask.type) {
    case TaskTypeEnum.FirmwareUpgrade:
      return {
        device: {
          id: payload.device.identification.id,
          model: payload.device.identification.model,
          type: payload.device.identification.type,
          name: payload.device.identification.name,
        },
        from: {
          semver: payload.device.firmware.semver.current,
        },
        to: {
          semver: payload.firmware.semver,
        },
      };
    default:
      return {};
  }
};

/**
 * @signature
 * parseDbTask :: (Object, Object) -> CorrespondenceTask
 *    CorrespondenceTask = Object
 *
 * @param {Object} auxiliaries
 * @param {DbTask} dbTask
 * @return {CorrespondenceTask}
 */
const parseDbTask = (auxiliaries, dbTask) => ({
  identification: {
    id: dbTask.id,
    batchId: dbTask.batchId,
    type: dbTask.type,
  },
  overview: parseTaskOverview(auxiliaries, dbTask),
  progress: dbTask.progress,
  startTimestamp: Number(dbTask.startTime) || null,
  endTimestamp: Number(dbTask.endTime) || null,
  status: dbTask.status,
  error: dbTask.error,
});

/**
 * @signature
 * parseDbTaskList :: (Object, Object) -> CorrespondenceTaskList
 *    CorrespondenceTask = Object
 *    CorrespondenceTaskList = Array.<CorrespondenceTask>
 *
 * @param {Object} auxiliaries
 * @param {DbTask[]} dbTaskList
 * @return {CorrespondenceTask[]}
 */
const parseDbTaskList = (auxiliaries, dbTaskList) => map(partial(parseDbTask, [auxiliaries]), dbTaskList);

module.exports = {
  parseDbTask,
  parseDbTaskList,

  safeParseDb: liftParser(parseDbTask),
  safeParseDbList: liftParser(parseDbTaskList),
};
