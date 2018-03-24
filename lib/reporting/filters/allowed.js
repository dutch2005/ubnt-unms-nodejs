'use strict';

const Stream = require('stream');

class AllowedFilter extends Stream.Transform {
  constructor(isAllowedCheck) {
    super({ objectMode: true, decodeStrings: false });

    this.isAllowed = isAllowedCheck;
  }

  _transform(data, encoding, next) {
    if (this.isAllowed()) {
      this.push(data);
    }
    next();
  }
}

module.exports = AllowedFilter;
