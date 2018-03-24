'use strict';

const { weave } = require('ramda-adjunct');

const events = require('./events');
const registerHandler = require('./register');
const closeHandler = require('../common/close');
const systemHandler = require('./system');
const interfacesHandler = require('./interfaces');
const updateHandler = require('../common/update');
const configChangeHandler = require('../common/config-change');

const register = (server, queue) => {
  const { DB, backups, messageHub, eventLog, settings, dal } = server.plugins;

  queue.registerHandlers({
    [events.Register]: weave(registerHandler, { DB, messageHub }),
    [events.Close]: weave(closeHandler, { DB, messageHub, dal }),
    [events.System]: systemHandler,
    [events.Interfaces]: weave(interfacesHandler, { eventLog }),
    [events.Update]: weave(updateHandler, { DB }),
    [events.ConfigChange]: weave(configChangeHandler, { backups, settings }),
  });
};

module.exports = register;
