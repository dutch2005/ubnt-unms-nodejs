'use strict';

const { weave } = require('ramda-adjunct');

const events = require('./events');
const registerHandler = require('./register');
const closeHandler = require('../common/close');
const updateHandler = require('../common/update');
const statisticsHandler = require('../common/statistics');
const configChangeHandler = require('../common/config-change');

const register = (server, queue) => {
  const { DB, backups, statistics, messageHub, settings, dal } = server.plugins;

  queue.registerHandlers({
    [events.Register]: weave(registerHandler, { DB, messageHub }),
    [events.Close]: weave(closeHandler, { DB, messageHub, dal }),
    [events.Update]: weave(updateHandler, { DB }),
    [events.Statistics]: weave(statisticsHandler, { DB, statistics }),
    [events.ConfigChange]: weave(configChangeHandler, { backups, settings }),
  });
};

module.exports = register;
