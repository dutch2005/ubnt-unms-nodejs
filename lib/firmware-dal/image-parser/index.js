'use strict';

const peek = require('peek-stream');
const { curry } = require('lodash/fp');

const extractInfoFromBin = require('./bin');
const extractInfoFromTar = require('./tar');
const extractInfoFromStk = require('./stk');
const { UnknownFirmwareImage } = require('./common');
const { isTar } = require('./utils');

// amount of bytes to read to determine the file type
const PEEK_BYTES = 10000;

// known firmware types
const FileTypeEnum = {
  Tar: 'tar',
  Bin: 'bin',
  Stk: 'stk',
  Unknown: 'unknown',
};

const detectFileType = (buf) => {
  if (buf === null || buf.length < 10) {
    return FileTypeEnum.Unknown;
  }

  // check bytes for `ustar`
  if (isTar(buf)) {
    return FileTypeEnum.Tar;
  }

  if (buf.length > 0x74 // STK header + 1 component
    && buf[0x4] === 0x55 // U
    && buf[0x5] === 0x42 // B
    && buf[0x6] === 0x4E // N
    && buf[0x7] === 0x54 // T
  ) {
    return FileTypeEnum.Stk;
  }

  // possible bin file
  if (buf[0x0] === 0x55 // U
    && buf[0x1] === 0x42 // B
    && buf[0x2] === 0x4E // N
    && buf[0x3] === 0x54 // T
  ) {
    return FileTypeEnum.Bin;
  }

  return FileTypeEnum.Unknown;
};

/**
 * @alias firmwareDetector
 */
const firmwareDetector = curry(
  /**
   * Based on detected firmware choose the parsing stream.
   *
   * @function firmwareDetector
   * @param {Function} callback
   * @param {Buffer} data
   * @param {Function} swap
   * @return {*}
   */
  (callback, data, swap) => {
    switch (detectFileType(data)) {
      case FileTypeEnum.Tar:
        return swap(null, extractInfoFromTar(callback));
      case FileTypeEnum.Bin:
        return swap(null, extractInfoFromBin(callback));
      case FileTypeEnum.Stk:
        return swap(null, extractInfoFromStk(callback));
      default:
        return swap(new UnknownFirmwareImage());
    }
  });

/**
 * Receives firmware filename
 *
 * @callback firmwareFilenameCallback
 * @param {string} firmwareFilename
 */

/**
 * Returns canonical firmware filename based on platformId, version and compile date.
 *
 * @param {firmwareFilenameCallback} callback
 * @return {Stream.<string>}
 */
const firmwareImageParser = callback => peek({
  strict: false,
  newline: false,
  maxBuffer: PEEK_BYTES,
}, firmwareDetector(callback));

module.exports = firmwareImageParser;
