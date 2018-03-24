'use strict';

const concatStream = require('concat-stream');
// TODO(michal.sedlak@ubnt.com): switch to tar-stream when PR #62 is merged
const tar = require('ubnt-m1ch4ls-tar-stream');
const through = require('through2');

const { isPlatformIdSupported } = require('../../feature-detection/firmware');
const { parseVersion, parsePlatformTypeToId, buildFirmwareFilename, UnknownFirmwareImage } = require('./common');

const PLATFORM_FILENAME = 'compat';
const VERSION_FILENAME = 'version.tmp';

/**
 * @function extractInfoFromBin
 * @param {firmwareFilenameCallback} callback
 * @return {stream.Transform}
 */
module.exports = (callback) => {
  const extractedInfo = {
    platformId: null,
    version: null,
  };

  const extractStream = tar.extract().on('entry', (header, stream, next) => {
    const filename = header.name;

    stream.on('end', next);

    if (filename === PLATFORM_FILENAME) {
      stream.pipe(concatStream((platformType) => {
        extractedInfo.platformId = parsePlatformTypeToId(platformType.toString());
      }));
    } else if (filename === VERSION_FILENAME) {
      stream.pipe(concatStream((version) => { extractedInfo.version = parseVersion(version.toString()) }));
    } else {
      stream.resume();
    }
  });

  return through.obj((chunk, encoding, next) => {
    // write everything to the tar extractor
    extractStream.write(chunk, encoding, next);
  }, (next) => {
    // end tar extractor and flush firmware file name
    extractStream.end(() => {
      if (extractedInfo.platformId === null
        || extractedInfo.version === null
        || !isPlatformIdSupported(extractedInfo.platformId)
      ) {
        return next(new UnknownFirmwareImage());
      }

      const filename = buildFirmwareFilename({
        platformId: extractedInfo.platformId,
        semver: extractedInfo.version.semver,
        compileDate: extractedInfo.version.compileDate,
        ext: 'tar',
      });

      callback(filename);

      return next(null, filename);
    });
  }).on('error', () => extractStream.destroy());
};
