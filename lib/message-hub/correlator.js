'use strict';

const aguid = require('aguid');

/* eslint-disable class-methods-use-this */
class Correlator {
  queueName(options, callback) {
    if (options.routingKey) {
      callback(null, options.queueName);
    } else {
      callback(null, `${options.queueName}.${aguid()}`);
    }
  }
}

module.exports = Correlator;
