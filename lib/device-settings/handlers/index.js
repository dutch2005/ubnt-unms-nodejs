'use strict';

const { weave } = require('ramda-adjunct');

const propagateSettings = require('./propagateSettings');

exports.register = (server, messageHub, messages) => {
  const { deviceSettings, deviceStore, settings } = server.plugins;

  const propagateSettingsBound = weave(propagateSettings, { deviceSettings, deviceStore, settings, messageHub });

  const { settingsChanged } = messages;
  messageHub.subscribe(settingsChanged, propagateSettingsBound);
};
