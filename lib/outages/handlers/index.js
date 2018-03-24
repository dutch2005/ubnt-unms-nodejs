'use strict';

const { weave } = require('ramda-adjunct');

const deviceConnected = require('./deviceConnected');
const deviceRemoved = require('./deviceRemoved');
const deviceDisconnected = require('./deviceDisconnected');

exports.register = (server, messageHub, messages) => {
  const { outages, dal } = server.plugins;

  const deviceConnectedBound = weave(deviceConnected, { outages, messageHub });
  const deviceDisconnectedBound = weave(deviceDisconnected, { outages, messageHub });
  const deviceRemovedBound = weave(deviceRemoved, { outages, messageHub, dal });

  messageHub.subscribe(messages.deviceRemoved, deviceRemovedBound);
  messageHub.subscribe(messages.deviceConnected, deviceConnectedBound);
  messageHub.subscribe(messages.deviceDisconnected, deviceDisconnectedBound);
};
