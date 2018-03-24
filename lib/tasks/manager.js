'use strict';

const { Reader: reader } = require('monet');
const { invokeArgs, isUndefined, map, partialRight, get, spread } = require('lodash/fp');

const { error: logError } = require('../logging');
const { TaskStatusEnum } = require('../enums');
const { resolveP, tapP, allP } = require('../util');

/**
 * @param {TaskQueue[]} queues
 * @param {DbTask} task
 * @return {TaskQueue}
 */
const findQueue = (queues, task) => {
  const queue = queues.find(invokeArgs('canProcess', [task]));
  if (isUndefined(queue)) {
    logError('Cannot find queue for given task', task);

    // throw
    throw new Error('Cannot find queue for given task');
  }

  return queue;
};

/**
 * @param {DbTask} task
 * @return {Reader.<enqueueTask~callback>}
 */
const enqueueTask = task => reader(
  /**
   * @function enqueueTask~callback
   * @param {TaskQueue[]} queues
   * @return {Promise.<DbTask>}
   */
  ({ queues }) => {
    const queue = findQueue(queues, task);
    queue.enqueue(task.id, task.payload);
    return resolveP(task);
  }
);

/**
 * @param {DbTask} task
 * @param {?string} [userId]
 * @return {Reader.<cancelTask~callback>}
 */
const cancelTask = (task, userId = null) => reader(
  /**
   * @function cancelTask~callback
   * @param {TaskQueue[]} queues
   * @param {DbDal} dal
   * @param {EventLog} eventLog
   * @return {Promise.<DbTask>}
   */
  ({ queues, dal, eventLog }) => {
    const queue = findQueue(queues, task);
    queue.cancel(task.id, task.payload);

    const dbTaskPromise = dal.taskRepository.update({
      id: task.id, status: TaskStatusEnum.Canceled, endTime: new Date(),
    });
    const dbDeviceMetadata = dbTaskPromise
      .then(get(['payload', 'device', 'identification', 'id']))
      .then(deviceId => dal.deviceMetadataRepository.findById(deviceId));

    return allP([dbTaskPromise, dbDeviceMetadata])
      .then(tapP(spread(partialRight(eventLog.logTaskCancel, [userId]))));
  }
);

/**
 * @param {string} taskId
 * @return {Reader.<startTask~callback>}
 */
const startTask = taskId => reader(
  /**
   * @function startTask~callback
   * @param {DbDal} dal
   * @param {EventLog} eventLog
   * @return {Promise.<DbTask>}
   */
  ({ dal, eventLog }) => {
    const dbTaskPromise = dal.taskRepository.update({
      id: taskId, status: TaskStatusEnum.InProgress, startTime: new Date(),
    });
    const dbDeviceMetadata = dbTaskPromise
      .then(get(['payload', 'device', 'identification', 'id']))
      .then(deviceId => dal.deviceMetadataRepository.findById(deviceId));

    return allP([dbTaskPromise, dbDeviceMetadata])
      .then(tapP(spread(eventLog.logTaskStart)));
  }

);

/**
 * @param {string} taskId
 * @param {number} progress
 * @return {Reader.<updateProgress~callback>}
 */
const updateProgress = (taskId, progress) => reader(
  /**
   * @function updateProgress~callback
   * @param {DbDal} dal
   * @return {Promise.<DbTask>}
   */
  ({ dal }) => dal.taskRepository.update({ id: taskId, progress })
);

/**
 * @param {string} taskId
 * @param {?string} [error]
 * @return {Reader.<failTask~callback>}
 */
const failTask = (taskId, error = null) => reader(
  /**
   * @function failTask~callback
   * @param {DbDal} dal
   * @param {EventLog} eventLog
   * @return {Promise.<DbTask>}
   */
  ({ dal, eventLog }) => {
    const dbTaskPromise = dal.taskRepository.update({
      id: taskId, status: TaskStatusEnum.Failed, error, endTime: new Date(),
    });
    const dbDeviceMetadata = dbTaskPromise
      .then(get(['payload', 'device', 'identification', 'id']))
      .then(deviceId => dal.deviceMetadataRepository.findById(deviceId));

    return allP([dbTaskPromise, dbDeviceMetadata])
      .then(tapP(spread(eventLog.logTaskFail)));
  }
);

/**
 * @param {string} taskId
 * @return {Reader.<completeTask~callback>}
 */
const completeTask = taskId => reader(
  /**
   * @function completeTask~callback
   * @param {DbDal} dal
   * @param {EventLog} eventLog
   * @return {Promise.<DbTask>}
   */
  ({ dal, eventLog }) => {
    const dbTaskPromise = dal.taskRepository.update({
      id: taskId, status: TaskStatusEnum.Success, progress: 1.0, endTime: new Date(),
    });
    const dbDeviceMetadata = dbTaskPromise
      .then(get(['payload', 'device', 'identification', 'id']))
      .then(deviceId => dal.deviceMetadataRepository.findById(deviceId));

    return allP([dbTaskPromise, dbDeviceMetadata])
      .then(tapP(spread(eventLog.logTaskComplete)));
  }
);

/**
 * @param {string} taskId
 * @return {Reader.<startQueue~callback>}
 */
const startQueue = () => reader(
  /**
   * @function startQueue~callback
   * @param {DbDal} dal
   * @param {TaskQueue[]} queues
   * @param {EventLog} eventLog
   * @return {Promise.<DbTask>}
   */
  ({ dal, queues, eventLog }) => dal.taskRepository
    .findAll({ where: { status: { $in: [TaskStatusEnum.InProgress, TaskStatusEnum.Queued] } } })
    .then(map((task) => {
      if (task.status === TaskStatusEnum.InProgress) { return cancelTask(task).run({ dal, queues, eventLog }) }

      return enqueueTask(task).run({ dal, queues });
    }))
    .then(allP)
    .catch((error) => {
      logError('Task queue failed to start', error);
    })
);

module.exports = { enqueueTask, startTask, cancelTask, updateProgress, failTask, completeTask, startQueue };
