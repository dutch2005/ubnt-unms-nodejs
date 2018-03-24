'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const service = require('./service');
const { DB } = require('../../../db');


function register(server, options) {
  const { firmwareDal, dal, tasks } = server.plugins;

  /**
   * @name ApiTasks
   * @type {{
   *   listTaskBatches,
   *   cancelTaskBatch,
   *   batchesInProgress,
   *   listTasks,
   *   startTasks,
   * }}
   */
  const pluginApi = {
    listTaskBatches: weave(service.listTaskBatches, { dal }),
    cancelTaskBatch: weave(service.cancelTaskBatch, { tasks, dal }),
    batchesInProgress: weave(service.batchesInProgress, { dal }),
    listTasks: weave(service.listTasks, { dal }),
    startTasks: weave(service.startTasks, { dal, tasks, firmwareDal, DB }),
  };

  server.expose(pluginApi);

  registerRoutes(server, options, pluginApi);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiTasksV2.1',
  dependencies: ['dal', 'tasks', 'firmwareDal'],
};
