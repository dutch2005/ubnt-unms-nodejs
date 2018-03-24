'use strict';

const Boom = require('boom');
const { Subject, Observable, Scheduler: RxScheduler } = require('rxjs/Rx');
const { orderBy, head, getOr, curry, identity } = require('lodash/fp');
const aguid = require('aguid');

require('../util/observable');
const { DB } = require('../db');
const { writeDeviceBackupFile, removeOldDeviceBackupFiles, deleteBackupFile, getBackupDirName } = require('./util');
const { isNotNull } = require('../util');


const cancelBackupIfUnchanged = curry((deviceId, newBackup, previousBackup) => {
  const newCrc = newBackup.crc;
  const oldCrc = getOr(null, 'crc', previousBackup);
  const hasBackupChanged = isNotNull(newCrc) && newCrc !== oldCrc;

  return hasBackupChanged
    ? Observable.from(DB.device.insertBackup(deviceId, newBackup))
    : Observable.from(deleteBackupFile(deviceId, newBackup.id));
});

class DeviceBackupQueue {
  constructor(deviceStore, logging, { concurrency = 1, delay: delayPeriod = 0 } = {}, rxScheduler = RxScheduler.async) {
    this.deviceStore = deviceStore;
    this.logging = logging;
    this.scheduled = new Set();
    this.queue = new Subject();

    const createDeviceBackup = this.createDeviceBackup.bind(this);
    const delay$ = Observable.timer(delayPeriod, rxScheduler);
    this.subscription = this.queue
      .filter(deviceId => !this.scheduled.has(deviceId))
      .groupBy(identity, identity, group => group.switchMapTo(delay$))
      .mergeMap(group => group.last())
      .do(deviceId => this.scheduled.add(deviceId))
      .mergeMap(createDeviceBackup, concurrency)
      .subscribe({
        error: (error) => { this.logging.error('Backup queue failed', error) },
      });
  }

  createDeviceBackup(deviceId) {
    const commDevice = this.deviceStore.get(deviceId);

    if (commDevice === null || !commDevice.supports('createBackup')) {
      this.scheduled.delete(deviceId);
      return Observable.empty();
    }

    const backupId = aguid();

    return Observable.from(DB.device.listBackups(deviceId))
      .map(orderBy('timestamp', 'desc'))
      .map(head)
      .mergeMap(previousBackup => commDevice.createBackup()
        .mergeMap(writeDeviceBackupFile(getBackupDirName(deviceId), backupId))
        .tapO(newBackup => cancelBackupIfUnchanged(deviceId, newBackup, previousBackup))
        .tapO(() => DB.device.listBackups(deviceId).then(removeOldDeviceBackupFiles(deviceId)))
      )
      .catch((error) => {
        this.logging.error(`Backup for device ${deviceId} failed`, error);
        return Observable.empty();
      })
      .finally(() => {
        this.scheduled.delete(deviceId);
      });
  }

  create(deviceId) {
    const commDevice = this.deviceStore.get(deviceId);

    if (commDevice === null) {
      return Observable.throw(Boom.notFound());
    }

    if (!commDevice.supports('createBackup')) {
      return Observable.throw(Boom.notImplemented());
    }

    const backupId = aguid();

    return commDevice.createBackup()
      .mergeMap(writeDeviceBackupFile(getBackupDirName(deviceId), backupId))
      .tapO(DB.device.insertBackup(deviceId))
      .tapO(() => DB.device.listBackups(deviceId).then(removeOldDeviceBackupFiles(deviceId)));
  }

  scheduleBackup(deviceId) {
    this.queue.next(deviceId);
  }

  destroy() {
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}

module.exports = DeviceBackupQueue;
