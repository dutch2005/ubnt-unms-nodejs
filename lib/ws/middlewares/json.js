'use strict';

const { assign } = require('lodash/fp');

const { MessageParsingFailedError } = require('../errors');

const handleIncoming = (message) => {
  try {
    return assign(message, { json: message.payload, payload: JSON.parse(message.payload) });
  } catch (error) {
    throw new MessageParsingFailedError(message, error.message);
  }
};

const handleOutgoing = message => assign(message, {
  original: message.payload,
  payload: JSON.stringify(message.payload),
});


module.exports = {
  handleIncoming,
  handleOutgoing,
};
