'use strict';

/**
 * @file
 *
 * More information about STK format can be found in the ES git repository
 *
 * STK file format: https://github.com/ubiquiti/esw-FastPath/blob/es-ng-dev/src/l7public/common/stk.h
 * Uboot multi file: https://github.com/ubiquiti/esw-FastPath/blob/es-ng-dev/src/l7tools/build/utils/image.h
 *
 * Composition is as follows:
 * STK -> U-boot (multi-file) -> .tar.gz -> fastpath.vpd
 *
 * Streams are composed together by peeking first X bytes and selecting next correct stream for parsing the file
 */

const concatStream = require('concat-stream');
const moment = require('moment-timezone');
const tar = require('ubnt-m1ch4ls-tar-stream');
const peek = require('peek-stream');
const gunzipMaybe = require('gunzip-maybe');
const through = require('through2');
const pump = require('pump');

const { isPlatformIdSupported } = require('../../../feature-detection/firmware');
const { extractStk, extractUboot } = require('./extract');
const { buildFirmwareFilename, parseVersion } = require('../common');
const { isUbootImage, isTar, NullStream } = require('../utils');

const TIMESTAMP_FORMAT = 'ddd MMM DD HH:mm:ss ZZ YYYY';

const tarMaybe = (entryCallback) => {
  const extract = (buf, swap) => {
    if (isTar(buf)) {
      swap(null, tar.extract().on('entry', entryCallback));
    } else {
      swap(null, new NullStream());
    }
  };

  return peek({
    strict: false,
    newline: false,
    maxBuffer: 512,
  }, extract);
};

const extractStkStream = entryCallback => extractStk().on('entry', (stkEntry, stkEntryStream, stkNext) => {
  const ubootImageDetect = (buf, swap) => {
    if (isUbootImage(buf)) {
      const extract = extractUboot().on('entry', (entry, stream, next) => {
        pump(stream, gunzipMaybe(), tarMaybe(entryCallback), next);
      });
      swap(null, extract);
    } else {
      swap(null, through());
    }
  };

  pump(stkEntryStream, peek({
    strict: false,
    newline: false,
    maxBuffer: 64,
  }, ubootImageDetect), stkNext);
});

const extractFilename = (vpdFileBuffer) => {
  const content = vpdFileBuffer.toString();

  const versionString = content.match(/Operational Code Image File Name - ([^\n]+)/);
  const compileTimestamp = content.match(/Timestamp - ([^\n]+)/);
  if (versionString === null || compileTimestamp === null) { return null }

  const parsedVersion = parseVersion(versionString[1]);
  const compileDate = moment(compileTimestamp[1], TIMESTAMP_FORMAT);

  if (parsedVersion === null || !compileDate.isValid() || !isPlatformIdSupported(parsedVersion.platformId)) {
    return null;
  }

  return buildFirmwareFilename({
    platformId: parsedVersion.platformId,
    semver: parsedVersion.semver,
    compileDate: compileDate.format('YYMMDD'),
    ext: 'stk',
  });
};

/**
 * @function extractInfoFromStk
 * @param {firmwareFilenameCallback} callback
 * @return {stream.Transform}
 */
module.exports = (callback) => {
  const entryCallback = (entry, stream, next) => {
    if (entry.type === 'file' && entry.name === './fastpath.vpd') {
      pump(stream, concatStream((content) => { callback(extractFilename(content)) }), next);
    } else {
      stream.on('end', next);
      stream.resume();
    }
  };

  return extractStkStream(entryCallback);
};
