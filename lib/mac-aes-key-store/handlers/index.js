'use strict';

const { weave } = require('ramda-adjunct');

const removeAesKey = require('./removeAesKey');

exports.register = (server, messageHub, messages) => {
  const { macAesKeyStore } = server.plugins;

  const removeAesKeyBound = weave(removeAesKey, { macAesKeyStore, messageHub });

  const { deviceRemoved } = messages;
  messageHub.subscribe(deviceRemoved, removeAesKeyBound);
};
