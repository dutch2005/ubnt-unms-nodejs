'use strict';

const { parseIncomingMessage } = require('../transformers/socket/parsers');

module.exports = {
  handleIncoming: parseIncomingMessage,
};
