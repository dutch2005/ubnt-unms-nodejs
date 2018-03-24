'use strict';

const Stream = require('stream');
const { contains, __ } = require('ramda');

class ResponseFilter extends Stream.Transform {
  constructor({ methods } = {}) {
    super({ objectMode: true, decodeStrings: false });

    this.isMethodAllowed = contains(__, methods);
  }

  _transform(data, encoding, next) {
    if (data.event !== 'response' || this.isMethodAllowed(data.method)) {
      this.push(data);
    }

    next();
  }
}

module.exports = ResponseFilter;
