'use strict';

const Stream = require('stream');
const Logentries = require('le_node');
const { defaults } = require('lodash/fp');

const defaultConfig = {
  levels: [
    'debug',
    'info',
    'notice',
    'warning',
    'error',
    'critical',
    'alert',
    'emergency',
  ],
  timestamp: true,
  withLevel: true,
  withStack: true,
  reconnectFailAfter: 3,
  bufferSize: 100,
  secure: true,
};

const applyDefaultConfig = defaults(defaultConfig);

class ReporterLogentries extends Stream.Writable {
  constructor(config = {}) {
    super({ objectMode: true, decodeStrings: false });

    this.client = new Logentries(applyDefaultConfig(config));
  }

  _write(data, encoding, cb) {
    this.client.log(data);
    cb();
  }
}

module.exports = ReporterLogentries;
