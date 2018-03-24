'use strict';

const { Writable } = require('stream');

const StkParser = require('./parser/stk');
const UbootParser = require('./parser/uboot');

class Extract extends Writable {
  constructor(Parser, options) {
    super(options);
    this.destroyed = false;
    this.parser = new Parser(this);
  }

  destroy(error) {
    if (this.destroyed) {
      return;
    }

    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
    this.parser.destroy();
  }

  _write(data, encoding, callback) {
    if (this.destroyed) { return null }

    return this.parser.parse(data, encoding, callback);
  }
}

class StkExtract extends Extract {
  constructor(options) {
    super(StkParser, options);
  }
}

class UbootExtract extends Extract {
  constructor(options) {
    super(UbootParser, options);
  }
}

function extractStk(options) {
  return new StkExtract(options);
}

function extractUboot(options) {
  return new UbootExtract(options);
}

module.exports = { extractStk, extractUboot };
