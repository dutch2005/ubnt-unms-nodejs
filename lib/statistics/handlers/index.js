'use strict';

const { weave } = require('ramda-adjunct');

const removeStatistics = require('./removeStatistics');

exports.register = (server, messageHub, messages) => {
  const { statistics } = server.plugins;

  const removeStatisticsBound = weave(removeStatistics, { statistics, messageHub });

  const { deviceRemoved } = messages;

  messageHub.subscribe(deviceRemoved, removeStatisticsBound);
};
