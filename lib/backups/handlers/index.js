'use strict';

const { weave } = require('ramda-adjunct');

const removeBackups = require('./removeBackups');

exports.register = (server, messageHub, messages) => {
  const { backups } = server.plugins;

  const removeBackupsBound = weave(removeBackups, { backups, messageHub });

  const { deviceRemoved } = messages;

  messageHub.subscribe(deviceRemoved, removeBackupsBound);
};
