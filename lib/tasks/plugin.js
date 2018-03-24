'use strict';

const { forEach, invoke } = require('lodash/fp');
const delay = require('delay');
const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');
const { error: logError } = require('../logging');
const manager = require('./manager');
const { TaskQueue } = require('./queue');
const { toMs } = require('../util');
const firmwareUpgradeTask = require('./firmware-upgrade');
const upgradeStatusReaper = require('./firmware-upgrade/status-reaper');


const setupQueues = dependencies => [
  new TaskQueue(
    weave(firmwareUpgradeTask.worker, dependencies),
    firmwareUpgradeTask.discriminator,
    weave(firmwareUpgradeTask.canceler, dependencies),
    weave(firmwareUpgradeTask.onEnqueue, dependencies),
    { paused: true } // start upgrade tasks paused
  ),
];

const QUEUES_START_DELAY = toMs('seconds', 30);

function register(server) {
  const config = server.settings.app;
  const { DB, dal, scheduler, deviceStore, settings, firmwareDal, eventLog } = server.plugins;

  const queues = [];

  /**
   * @name Tasks
   * @type {{
   *   enqueueTask: function(DbTask):Promise.<DbTask>,
   *   cancelTask: function(DbTask):Promise.<DbTask>,
   *   startTask: function(taskId: string):Promise.<DbTask>,
   *   updateProgress: function(string, number):Promise.<DbTask>,
   *   failTask: function(string, string=):Promise.<DbTask>,
   *   completeTask: function(string):Promise.<DbTask>,
   *   startQueue: function():Promise.<DbTask[]>,
   * }}
   */
  const pluginApi = {
    enqueueTask: weave(manager.enqueueTask, { dal, queues }),
    cancelTask: weave(manager.cancelTask, { dal, queues, eventLog }),
    startTask: weave(manager.startTask, { dal, eventLog }),
    updateProgress: weave(manager.updateProgress, { dal }),
    failTask: weave(manager.failTask, { dal, eventLog }),
    completeTask: weave(manager.completeTask, { dal, eventLog }),
    startQueue: weave(manager.startQueue, { dal, queues, eventLog }),
    upgradeStatusReaper: weave(upgradeStatusReaper, { DB, dal }),
  };

  queues.push(...setupQueues({ dal, taskManager: pluginApi, deviceStore, settings, firmwareDal, DB }));

  server.expose(pluginApi);

  // this is meant to run asynchronously, do not return the promise
  pluginApi.startQueue()
    .then(delay(QUEUES_START_DELAY, queues))
    .then(forEach(invoke('resume'))) // resume paused queues
    .catch(error => logError('Task queue failed to resume', error));

  // register periodic tasks
  if (!config.demo) {
    scheduler.registerPeriodicTask(pluginApi.upgradeStatusReaper, toMs('minute', 1), 'upgradeStatusReaper');
  }
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'tasks',
  dependencies: ['DB', 'dal', 'scheduler', 'deviceStore', 'settings', 'firmwareDal', 'eventLog'],
};

