'use strict';

const { noop } = require('lodash/fp');
const bl = require('bl');

class BaseParser {
  constructor(extractStream) {
    this.offset = 0;
    this.missing = 0;
    this.buffer = bl();
    this.overflow = null;
    this.callback = noop;
    this.encoding = undefined;

    this.entryStream = null;
    this.extractStream = extractStream;
    this.onNext = noop;
  }

  next(size, onNextFn) {
    this.offset += size;
    this.size = size;
    this.missing = size;
    this.onNext = onNextFn;
  }

  continue() {
    const { callback } = this;
    this.callback = noop;
    if (this.overflow !== null) {
      this.parse(this.overflow, this.encoding, callback);
    } else {
      callback();
    }
  }

  /**
   * @param {Buffer} data
   * @param {string} encoding
   * @param {Function} callback
   * @return {*}
   */
  parse(data, encoding, callback) {
    const { buffer, entryStream, missing } = this;

    if (data.length < missing) {
      this.missing -= data.length;
      this.overflow = null;
      if (entryStream !== null) {
        return entryStream.write(data, encoding, callback);
      }
      buffer.append(data);
      return callback();
    }

    this.missing = 0;
    this.encoding = encoding;
    this.callback = callback;
    this.overflow = null;

    let slicedData = data;
    if (data.length > missing) {
      this.overflow = data.slice(missing);
      slicedData = data.slice(0, missing);
    }

    if (entryStream !== null) {
      entryStream.end(slicedData);
    } else {
      buffer.append(slicedData);
    }
    return this.onNext();
  }

  destroy() {
    if (this.entryStream !== null) {
      this.entryStream.emit('close');
    }
  }
}

module.exports = BaseParser;
