'use strict';

const { parseIncomingMessage } = require('../transformers/parsers');

module.exports = {
  handleIncoming: parseIncomingMessage,
};
