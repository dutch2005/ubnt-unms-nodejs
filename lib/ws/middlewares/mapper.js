'use strict';

const { memoize } = require('lodash/fp');
const aguid = require('aguid');
const { when } = require('ramda');
const { isNotString } = require('ramda-adjunct');

const toSocketOutgoingMessage = outgoingMessage => ({
  id: when(isNotString, aguid, outgoingMessage.id),
  socket: outgoingMessage.socket,
  type: outgoingMessage.type,
  name: outgoingMessage.name,
  timestamp: Date.now(),
  request: outgoingMessage.request,
  data: outgoingMessage.data,
});

const messageMapper = protocolVersion => ({
  handleOutgoing(message) {
    const payload = toSocketOutgoingMessage(message);
    payload.protocol = protocolVersion;

    return {
      payload,
      meta: message.meta,
      original: message,
    };
  },
});

module.exports = memoize(messageMapper);
