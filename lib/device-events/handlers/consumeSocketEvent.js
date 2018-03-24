'use strict';

const { Reader: reader } = require('monet');

module.exports = ({ deviceId, payload }, message) => reader(
  ({ deviceEvents }) => {
    const routingKeyParts = message.fields.routingKey.split('.');
    const type = `${routingKeyParts[1]}-${routingKeyParts[3]}`;

    deviceEvents.add({ deviceId, type, payload });
  }
);
