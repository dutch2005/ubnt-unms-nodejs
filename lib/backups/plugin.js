'use strict';

const boom = require('boom');
const { weave } = require('ramda-adjunct');

const {
  isAppLocked, backupToFile, restoreFromDir, removeDeviceConfigBackupsByDeviceId,
  cleanUnmsBackupDir, cleanDeviceConfigBackupMultiDir, cleanUnmsRestoreDir,
} = require('./index');
const { registerPlugin } = require('../util/hapi');
const DeviceBackupQueue = require('./device-backup-queue');
const handlers = require('./handlers');

function register(server) {
  server.ext('onRequest', (request, reply) => (
    isAppLocked() ? reply(boom.serverUnavailable('Application is locked for maintenance')) : reply.continue())
  );

  const config = server.settings.app;
  const { firmwareDal, logging, deviceStore, messageHub, DB, scheduler } = server.plugins;

  const deviceBackupQueue = new DeviceBackupQueue(deviceStore, logging, config.deviceConfigBackup.queue);

  const pluginApi = {
    backupToFile: weave(backupToFile, { config, firmwareDal }),
    restoreFromDir: weave(restoreFromDir, { config, firmwareDal, messageHub, DB }),
    removeDeviceConfigBackupsByDeviceId: weave(removeDeviceConfigBackupsByDeviceId, { DB }),
  };

  server.expose(pluginApi);
  server.expose('deviceBackup', deviceBackupQueue);

  server.once('stop', () => { deviceBackupQueue.destroy() });

  messageHub.registerHandlers(handlers);

  // register scheduled tasks
  if (!config.demo) {
    scheduler.registerDailyTask(() => cleanUnmsBackupDir(config.nmsBackup), 'cleanUnmsBackupDir');
    scheduler.registerDailyTask(() => cleanUnmsRestoreDir(config.nmsBackup), 'cleanUnmsRestoreDir');
    scheduler.registerDailyTask(
      () => cleanDeviceConfigBackupMultiDir(config.deviceConfigBackup), 'cleanDeviceConfigBackupMultiDir'
    );
  }
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'backups',
  version: '1.0.0',
  dependencies: ['DB', 'scheduler', 'deviceStore', 'logging', 'firmwareDal', 'messageHub'],
};
