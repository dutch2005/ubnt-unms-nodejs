'use strict';

const aguid = require('aguid');
const { match } = require('ramda');
const lodash = require('lodash');
const { map, isNull, reject, partial, flow, zipObject, isUndefined, some, defaultTo } = require('lodash/fp');
const path = require('path');
const crypto = require('crypto');
const base64url = require('base64-url');
const moment = require('moment-timezone');

const {
  modelsForPlatformId, isFirmwareSupported, hasCustomScriptsSupport,
} = require('../../feature-detection/firmware');
const { parseStableVersion, parseSemver, parseCommFirmwareVersion } = require('../semver/parsers');
const { firmwares: firmwaresConfig, secureLinkSecret } = require('../../settings');
const { liftParser } = require('../index');

/**
 * @typedef {Object} FirmwareFileInfo
 * @property {string} filename
 * @property {FirmwareOriginEnum} origin
 * @property {number} size Size in bytes
 */

/**
 * @typedef {Object} CorrespondenceFirmware
 * @property {Object} identification
 * @property {string} identification.id
 * @property {string} identification.version
 * @property {boolean} identification.stable Whether or not is this stable version
 * @property {boolean} identification.unms Whether or not has UNMS support
 * @property {string} identification.filename
 * @property {FirmwareOriginEnum} identification.origin
 * @property {FirmwarePlatformIdEnum} identification.platformId
 * @property {Array.<DeviceModelEnum>} identification.models
 * @property {Object} supports
 * @property {boolean} supports.airMaxCustomScripts
 * @property {boolean} supports.UNMS
 * @property {SemVer} semver
 * @property {string} path
 * @property {string} url
 * @property {string} secureUrl
 * @property {number} size
 * @property {number} date Unix timestamp in milliseconds
 */

/**
 * @param {CorrespondenceFirmware} firmware
 * @return {string} secure url
 */
const secureFirmwareUrl = (firmware) => {
  const hash = crypto.createHash('md5');
  const { urlExpiration } = firmwaresConfig();
  const timestamp = moment().add(urlExpiration, 'milliseconds').unix();
  const { origin, filename } = firmware.identification;
  const secret = secureLinkSecret();

  hash.update(`${timestamp}${origin}${filename} ${secret}`);
  const fingerprint = hash.digest('base64');

  return `/${timestamp}/${base64url.escape(fingerprint)}/${origin}/${filename}`;
};

/**
 * @function generateFirmwareId
 * @params {string} origin
 * @params {string} filename
 * @return {string}
 */
const generateFirmwareId = lodash.memoize(
  (origin, filename) => aguid(`${origin}~${filename}`),
  (origin, filename) => `${origin}~${filename}`
);

const matchFilename = match(/^([\d\w]+)-(.+)\.(\d{6})\.\w{3}$/);
//                          e100-1.9.6-alpha2.170220.(tar|bin|stk)
//                            ^  ^            ^
//                            |  |            |
//                   Platform ID |            |
//                         Version            |
//                                 compile date

const parseFilename = flow(
  matchFilename,
  zipObject(['filename', 'platformId', 'version', 'date'])
);

/**
 * parseFile :: (Object, Object) -> CorrespondenceFirmware
 *    CorrespondenceFirmware = Object
 *
 * @param {Object} auxiliaries
 * @param {FirmwareFileInfo} file
 * @return {?CorrespondenceFirmware}
 */
const parseFile = (auxiliaries, file) => {
  const fileInfo = parseFilename(file.filename);

  // not a valid filename, ignore
  if (some(isUndefined, fileInfo)) { return null }

  const parsedVersion = parseSemver(parseCommFirmwareVersion(fileInfo.version));

  // not a valid semver, ignore
  if (parsedVersion === null) { return null }

  return {
    identification: {
      id: generateFirmwareId(file.origin, file.filename),
      version: parsedVersion.raw,
      stable: parseStableVersion(parsedVersion),
      filename: file.filename,
      origin: file.origin,
      platformId: fileInfo.platformId,
      models: defaultTo([], modelsForPlatformId(fileInfo.platformId)),
    },
    supports: {
      airMaxCustomScripts: hasCustomScriptsSupport(fileInfo.platformId, fileInfo.version),
      UNMS: isFirmwareSupported(fileInfo.platformId, fileInfo.version),
    },
    semver: parsedVersion,
    get path() {
      const { dir } = firmwaresConfig();
      return path.join(dir, file.origin, file.filename);
    },
    url: `${file.origin}/${file.filename}`,
    get secureUrl() {
      return secureFirmwareUrl(this);
    },
    size: file.size,
    date: moment(fileInfo.date, 'YYMMDD').valueOf(),
  };
};

// parseFile :: (Object, Array) -> Array
const parseFileList = (auxiliaries, fileList) => flow(
  map(partial(parseFile, [auxiliaries])),
  reject(isNull)
)(fileList);

module.exports = {
  parseFile,
  parseFileList,

  safeParseFile: liftParser(parseFile),
  safeParseFileList: liftParser(parseFileList),
};
