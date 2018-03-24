'use strict';

const { identity, isString, constant, getOr, defaultTo } = require('lodash/fp');

const routingKeyTag = (parts, ...keys) => {
  let pattern = parts.join('*');
  if (keys.length > 0 && keys.length >= parts.length) {
    pattern += '*';
  }

  const creator = (payload) => {
    const result = [parts[0]];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const value = getOr('unknown', key, payload);
      result.push(value);
      if (parts.length > i + 1) {
        result.push(parts[i + 1]);
      }
    }

    return result.join('');
  };

  return {
    pattern,
    creator,
  };
};

const createMessage = (messageRoutingKey, payloadCreator = identity) => {
  const { pattern, creator } = isString(messageRoutingKey)
    ? { pattern: messageRoutingKey, creator: constant(messageRoutingKey) }
    : messageRoutingKey;

  const messageCreator = (...args) => {
    const payload = defaultTo({}, payloadCreator(...args));
    const routingKey = creator(payload);

    return { routingKey, payload };
  };

  messageCreator.payloadCreator = creator;
  messageCreator.messageRoutingKey = messageRoutingKey;
  messageCreator.toString = constant(pattern);

  return messageCreator;
};

module.exports = {
  routingKeyTag,
  createMessage,
};
