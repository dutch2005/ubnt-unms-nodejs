'use strict';

const { SmartBuffer } = require('smart-buffer');
const through = require('through2');
const { Stream: NigelStream } = require('nigel');

const { isPlatformIdSupported } = require('../../feature-detection/firmware');
const { parseVersion, buildFirmwareFilename, UnknownFirmwareImage } = require('./common');

const HEADER_SIZE = 2000;
const HAYSTACK_BUFFER_SIZE = 250;

const versionStringSearch = (versionBuffer, onMatchCallback) => {
  const searchStream = new NigelStream(versionBuffer);
  searchStream.on('needle', () => {
    let bufferSize = versionBuffer.length;
    const bufferList = [versionBuffer];
    const collectHaystack = (chunk) => {
      bufferList.push(chunk);
      bufferSize += chunk.length;

      if (bufferSize > HAYSTACK_BUFFER_SIZE) {
        searchStream.removeListener('haystack', collectHaystack);
        const version = Buffer.concat(bufferList, HAYSTACK_BUFFER_SIZE);
        const newLinePosition = version.indexOf('\n');
        if (newLinePosition >= 0) {
          onMatchCallback(version.slice(0, newLinePosition + 1));
        }
        onMatchCallback(version);
      }
    };
    searchStream.on('haystack', collectHaystack);
  });

  return searchStream;
};

const extractFilename = (versionBuffer) => {
  const smartBuff = SmartBuffer.fromBuffer(versionBuffer);
  const parsedVersion = parseVersion(smartBuff.readStringNT());

  if (parsedVersion === null || !isPlatformIdSupported(parsedVersion.platformId)) { return null }

  return buildFirmwareFilename({
    platformId: parsedVersion.platformId,
    semver: parsedVersion.semver,
    compileDate: parsedVersion.compileDate,
    ext: 'bin',
  });
};

/**
 * @param {Buffer} buf
 * @return {boolean}
 */
const isOnuFirmware = buf => (
  buf.length > 0x68b
  && buf[0x684] === 0x55 // u
  && buf[0x685] === 0x42 // b
  && buf[0x686] === 0x4E // n
  && buf[0x687] === 0x54 // t
  && buf[0x688] === 0x5F // _
  && buf[0x689] === 0x53 // s
  && buf[0x68a] === 0x46 // f
  && buf[0x68b] === 0x55 // u
);

/**
 * @function extractInfoFromBin
 * @param {firmwareFilenameCallback} callback
 * @return {stream.Transform}
 */
module.exports = (callback) => {
  const bufferList = [];
  let searchStream = null;
  let size = 0;

  return through.obj(function parseBinFile(chunk, encoding, next) {
    if (size < HEADER_SIZE) {
      bufferList.push(chunk);
      size += chunk.length;

      if (size >= HEADER_SIZE) {
        const buff = Buffer.concat(bufferList);
        const smartBuff = SmartBuffer.fromBuffer(buff);
        const ubnt = smartBuff.readString(4); // read UBNT;

        if (ubnt !== 'UBNT') {
          return next(new UnknownFirmwareImage()); // end stream
        }

        // for ONU the full version string is not in the header
        if (isOnuFirmware(buff)) {
          smartBuff.skip(4); // skip leading bytes 00 3A 03 20

          // search for full version string in the whole file
          searchStream = versionStringSearch(smartBuff.readBufferNT(), (match) => {
            const filename = extractFilename(match);

            if (filename === null) { return } // found garbage, try again

            callback(filename);
            this.push(filename);
          });
        } else { // other have full firmware version in the header
          const filename = extractFilename(smartBuff.readBufferNT());

          if (filename === null) {
            return next(new UnknownFirmwareImage()); // end stream
          }

          callback(filename);
          this.push(filename);
        }
      }
    } else if (searchStream !== null) {
      searchStream.write(chunk);
    }

    return next();
  });
};
