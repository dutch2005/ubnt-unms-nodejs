'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { keyBy, get, __, has } = require('lodash/fp');
const { pathEq, dissocPath, allPass, anyPass } = require('ramda');

const { TaskStatusEnum, TaskTypeEnum, DeviceTypeEnum } = require('../../enums');
const { pathNotEq, pathNotSatisfies } = require('../../util');
const { error: logError } = require('../../logging');

const TASK_QUERY = {
  where: {
    type: TaskTypeEnum.FirmwareUpgrade,
    status: { $in: [TaskStatusEnum.InProgress, TaskStatusEnum.Queued] },
  },
};

/**
 * Does upgrade in progress status cleanup
 *
 * Runs periodically every x minute to ensure device is not stuck in upgrade in progress status
 *
 * @see application.js
 * @return {Reader.<upgradeStatusReaper~callback>}
 */
const upgradeStatusReaper = () => reader(
  /**
   * @function upgradeStatusReaper~callback
   * @param {DB} DB
   * @param {DbDal} dal
   * @return {Promise.<DbDevice[]>}
   */
  ({ DB, dal }) => Observable.forkJoin(dal.taskRepository.findAll(TASK_QUERY), DB.device.list())
    .mergeMap(([tasks, devices]) => {
      const tasksByDeviceId = keyBy(get(['payload', 'device', 'identification', 'id']), tasks);

      return devices.filter(allPass([
        pathNotEq(['identification', 'type'], DeviceTypeEnum.Onu),
        anyPass([
          pathEq(['upgrade', 'status'], TaskStatusEnum.Queued),
          pathEq(['upgrade', 'status'], TaskStatusEnum.InProgress),
        ]),
        pathNotSatisfies(has(__, tasksByDeviceId), ['identification', 'id']),
      ]));
    })
    .map(dissocPath(['upgrade']))
    .mergeMap(dbDevice => DB.device.update(dbDevice))
    .catch((error) => {
      logError('Upgrade status reaper failed', error);
      return Observable.empty();
    })
    .toPromise()
  )
;

module.exports = upgradeStatusReaper;
