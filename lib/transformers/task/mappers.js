'use strict';

const { map } = require('lodash/fp');

const { liftMapper } = require('../index');
const { TaskTypeEnum } = require('../../enums');
const { toApiSemver } = require('../firmwares/mappers');

/**
 * @typedef {Object} ApiTask
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
 * @signature mapTaskOverview :: CorrespondenceTask -> Object
 *    CorrespondenceTask = Object
 *
 * @param {CorrespondenceTask} correspondenceData
 * @return {*}
 */
const mapTaskOverview = (correspondenceData) => {
  const overview = correspondenceData.overview;
  switch (correspondenceData.identification.type) {
    case TaskTypeEnum.FirmwareUpgrade:
      return {
        device: {
          id: overview.device.id,
          model: overview.device.model,
          type: overview.device.type,
          name: overview.device.name,
        },
        from: {
          semver: toApiSemver(overview.from.semver),
        },
        to: {
          semver: toApiSemver(overview.to.semver),
        },
      };
    default:
      return {};
  }
};

/**
 * @signature
 * toApi :: CorrespondenceTask -> ApiTask
 *    CorrespondenceTask = Object
 *    ApiTask = Object
 *
 * @param {CorrespondenceTask} correspondenceData
 * @return {ApiTask}
 */
const toApi = correspondenceData => ({
  identification: {
    id: correspondenceData.identification.id,
    batchId: correspondenceData.identification.batchId,
    type: correspondenceData.identification.type,
  },
  overview: mapTaskOverview(correspondenceData),
  progress: correspondenceData.progress,
  startTimestamp: correspondenceData.startTimestamp,
  endTimestamp: correspondenceData.endTimestamp,
  status: correspondenceData.status,
  error: correspondenceData.error,
});

/**
 * @signature
 * toApiList :: CorrespondenceTaskList -> ApiTaskList
 *    CorrespondenceTaskList = Array.<CorrespondenceTask>
 *    ApiTaskList = Object
 *
 * @function toApiList
 * @param {CorrespondenceTask[]} correspondenceData
 * @return {ApiTask[]}
 */
const toApiList = map(toApi);

module.exports = {
  toApi,
  toApiList,

  safeToApi: liftMapper(toApi),
  safeToApiList: liftMapper(toApiList),
};
