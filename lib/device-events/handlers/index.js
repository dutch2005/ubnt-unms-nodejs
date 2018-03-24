'use strict';

const { weave } = require('ramda-adjunct');

const consumeSocketEvent = require('./consumeSocketEvent');

exports.register = (server, messageHub) => {
  const { deviceEvents } = server.plugins;

  messageHub.subscribe('socket.#', weave(consumeSocketEvent, { deviceEvents }));
};
