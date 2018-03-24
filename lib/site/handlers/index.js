'use strict';

const { weave } = require('ramda-adjunct');

const synchronizeSiteStatus = require('./synchronizeSiteStatus');

exports.register = (server, messageHub, messages) => {
  const { site } = server.plugins;
  const synchronizeSiteStatusBound = weave(synchronizeSiteStatus, { messageHub, site });

  const { deviceRemoved, deviceDisconnected, deviceConnected } = messages;

  messageHub.subscribe(deviceRemoved, synchronizeSiteStatusBound);
  messageHub.subscribe(deviceDisconnected, synchronizeSiteStatusBound);
  messageHub.subscribe(deviceConnected, synchronizeSiteStatusBound);
};
