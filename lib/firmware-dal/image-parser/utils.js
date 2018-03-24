'use strict';

const { Writable } = require('stream');

// check bytes for `ustar`
const isTar = buf => buf.length > 0x105
  && buf[0x101] === 0x75 // u
  && buf[0x102] === 0x73 // s
  && buf[0x103] === 0x74 // t
  && buf[0x104] === 0x61 // a
  && buf[0x105] === 0x72; // r

const isUbootImage = buf => buf.length >= 64
  && buf[0] === 0x27
  && buf[1] === 0x05
  && buf[2] === 0x19
  && buf[3] === 0x56;

class NullStream extends Writable {
  _write(data, encoding, callback) { // eslint-disable-line class-methods-use-this
    callback();
  }
}

module.exports = {
  isTar,
  isUbootImage,
  NullStream,
};
