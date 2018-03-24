'use strict';

const { PassThrough } = require('stream');

class EntryStream extends PassThrough {
  constructor(parent, offset) {
    super();
    this.offset = offset;
    this.parent = parent;
  }

  destroy() {
    this.parent.destroy();
  }
}

module.exports = EntryStream;

