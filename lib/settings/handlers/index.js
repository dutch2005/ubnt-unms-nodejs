'use strict';

const { weave } = require('ramda-adjunct');

const reloadSettings = require('./reloadSettings');

exports.register = (server, messageHub, messages) => {
  const { settings } = server.plugins;

  const reloadSettingsBound = weave(reloadSettings, { settings, messageHub });

  const { settingsChanged } = messages;
  messageHub.subscribe(settingsChanged, reloadSettingsBound);
};
