'use strict';

const { weave } = require('ramda-adjunct');

const events = require('./events');
const registerHandler = require('./register');
const closeHandler = require('./close');
const systemHandler = require('./system');
const interfacesHandler = require('./interfaces');
const ponHandler = require('./pon');
const onuListHandler = require('./onu-list');
const updateHandler = require('../common/update');
const configChangeHandler = require('../common/config-change');

const register = (server, queue) => {
  const { DB, backups, eventLog, messageHub, settings, dal } = server.plugins;

  queue.registerHandlers({
    [events.Register]: weave(registerHandler, { DB, messageHub }),
    [events.Close]: weave(closeHandler, { DB, messageHub, dal }),
    [events.System]: systemHandler,
    [events.Pon]: ponHandler,
    [events.OnuList]: weave(onuListHandler, { messageHub, DB }),
    [events.Interfaces]: weave(interfacesHandler, { eventLog }),
    [events.Update]: weave(updateHandler, { DB }),
    [events.ConfigChange]: weave(configChangeHandler, { backups, settings }),
  });
};

module.exports = register;
