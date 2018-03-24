'use strict';

const Stream = require('stream');
const { constant } = require('lodash/fp');

class DecorateEventFilter extends Stream.Transform {
  constructor({ getInstanceId, hostTag } = {}) {
    super({ objectMode: true, decodeStrings: false });

    this.getInstanceId = getInstanceId || constant('dev');
    this.hostTag = hostTag;
  }

  _transform(event, encoding, next) {
    event.instance = this.getInstanceId(); // eslint-disable-line no-param-reassign
    event.hostTag = this.hostTag; // eslint-disable-line no-param-reassign
    this.push(event);
    next();
  }
}

module.exports = DecorateEventFilter;
