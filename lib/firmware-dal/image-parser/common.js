'use strict';

const { zipObject, getOr, first, flow, update, trim, pick, eq, constant, toLower } = require('lodash/fp');
const ExtendableError = require('es6-error');
const { match, evolve, when, replace } = require('ramda');

const { FirmwarePlatformIdEnum } = require('../../enums');
const { parseCommFirmwareVersion } = require('../../transformers/semver/parsers');

/**
 * Error class thrown when invalid/unknown file is provided.
 */
class UnknownFirmwareImage extends ExtendableError {
  constructor(message = 'Unknown firmware image') {
    super(message);
  }
}

/**
 * Error class thrown when saved file md5 mismatched md5 expected.
 */
class MismatchMD5FirmwareImage extends ExtendableError {
  constructor(message = 'MD5 Firmware mismatch') {
    super(message);
  }
}

/**
 * Known EdgeRouter/EdgeSwitch/OLT platform types.
 * @type {Object<string, string>}
 */
const PLATFORM_TYPE_TO_PLATFORM_ID_MAP = Object.freeze({
  21001: FirmwarePlatformIdEnum.E50,
  20002: FirmwarePlatformIdEnum.E100,
  20003: FirmwarePlatformIdEnum.E200,
  20300: FirmwarePlatformIdEnum.E300,
  21002: FirmwarePlatformIdEnum.E600,
  20010: FirmwarePlatformIdEnum.E1000,
});

/**
 * Map product to our platform id for supported devices
 * @type {Object<string, string>}
 */
const UBNT_PRODUCT_TO_PLATFORM_ID_MAP = Object.freeze({
  e50: FirmwarePlatformIdEnum.E50,
  e100: FirmwarePlatformIdEnum.E100,
  e200: FirmwarePlatformIdEnum.E200,
  'uf-olt': FirmwarePlatformIdEnum.E600,
  e1000: FirmwarePlatformIdEnum.E1000,
  'uf-nano': FirmwarePlatformIdEnum.NanoG,
  esgh: FirmwarePlatformIdEnum.ESGH,
  eswh: FirmwarePlatformIdEnum.ESWH,
  XC: FirmwarePlatformIdEnum.XC,
  WA: FirmwarePlatformIdEnum.WA,
  TI: FirmwarePlatformIdEnum.TI,
  XM: FirmwarePlatformIdEnum.XM,
  XW: FirmwarePlatformIdEnum.XW,
});

const VERSION_FORMATS = [
  {
    // for AirMax, AirCube
    // e.g. BZ.ar7240.v3.7.40.6115.170208.1059
    // or   WA.ar934x.v2.3.4-devel-AOV-1901-keba@keba-VirtualBox-cs.170608.1845
    // or   ACB.ar934x.v0.9.0-devel-master.994a169ce2.170516.1454
    match: match(/^(WA|XC|2WA|2XC|XW|XM|TI|ACB)\.[\w\d]+\.(.*?\d+\.\d+\.\d+.*)[.@]([\w\d-]+)\.(\d{6})\.(\d{4})$/),
    extract: flow(
      zipObject(['input', 'platformId', 'semver', 'build', 'compileDate', 'compileTime']),
      pick(['platformId', 'semver', 'compileDate']),
      update('semver', parseCommFirmwareVersion)
    ),
  },
  {
    // for AirMax without zero
    // e.g. WA.ar934x.v8.3-devel-AOV-1901-keba@keba-VirtualBox-cs.170608.1845
    //      XC.qca955x.v8.3.34573.170614.1550
    match: match(/^(WA|XC|2WA|2XC|XW|XM|TI|ACB)\.[\w\d]+\.(.*?\d+\.\d+.*)[.@]([\w\d-]+)\.(\d{6})\.(\d{4})$/),
    extract: flow(
      zipObject(['input', 'platformId', 'semver', 'build', 'compileDate', 'compileTime']),
      pick(['platformId', 'semver', 'compileDate']),
      update('semver', parseCommFirmwareVersion)
    ),
  },
  {
    // for Onu
    // e.g. SFU.bcm96838.v1.0.1.170509.1713
    // e.g. UF_NANOG.bcm96838.v1.2.170919.08
    match: match(/^(SFU|UF_NANOG|UF_LOCO)\.[\w\d]+\.(.*?\d+\.\d+\.\d+.*)\.(\d{6})\.(\d{4})$/),
    extract: flow(
      zipObject(['input', 'platformId', 'semver', 'compileDate', 'compileTime']),
      pick(['platformId', 'semver', 'compileDate']),
      evolve({
        // TODO(michal.sedlak@ubnt.com): HACK: renaming NanoG platform
        platformId: when(eq('UF_NANOG'), constant(FirmwarePlatformIdEnum.NanoG)),
        semver: parseCommFirmwareVersion,
      })
    ),
  },
  {
    // for Onu without zero
    // e.g. SFU.bcm96838.v1.0.1.170509.1713
    // e.g. UF_NANOG.bcm96838.v1.2.170919.08
    match: match(/^(SFU|UF_NANOG|UF_LOCO)\.[\w\d]+\.(.*?\d+\.\d+.*)\.(\d{6})\.(\d{4})$/),
    extract: flow(
      zipObject(['input', 'platformId', 'semver', 'compileDate', 'compileTime']),
      pick(['platformId', 'semver', 'compileDate']),
      evolve({
        // TODO(michal.sedlak@ubnt.com): HACK: renaming NanoG platform
        platformId: when(eq('UF_NANOG'), constant(FirmwarePlatformIdEnum.NanoG)),
        semver: parseCommFirmwareVersion,
      })
    ),
  },
  {
    // for ER, OLT
    // e.g. Version:      v1.9.6alpha2.4961504.170302.0248
    match: match(/^Version(.+)\.(\d+)\.(\d{6})\.(\d{4})$/),
    extract: flow(
      zipObject(['input', 'semver', 'build', 'compileDate']),
      pick(['semver', 'compileDate']),
      update('semver', parseCommFirmwareVersion)
    ),
  },
  {
    // for ESGH, ESWH
    // e.g. ESGH.v1.7.1.4993748 or ESWH.v9.8.0.5043906d for debug builds
    match: match(/^(ESGH|ESWH)\.v(\d+\.\d+\.\d+[^.]*)\.(\d+)d?$/),
    extract: flow(
      zipObject(['input', 'platformId', 'semver', 'build']),
      pick(['semver', 'platformId']),
      evolve({
        platformId: toLower,
        semver: parseCommFirmwareVersion,
      })
    ),
  },
];

const parsePlatformTypeToId = (str) => {
  const platformType = first(str.split(':', 1));
  return getOr(null, platformType, PLATFORM_TYPE_TO_PLATFORM_ID_MAP);
};

const sanitizeVersionString = flow(String, replace(/[^\dA-Za-z_.@-]/g, ''), trim);

const parseVersion = (rawVersionString) => {
  const versionString = sanitizeVersionString(rawVersionString);

  for (const format of VERSION_FORMATS) { // eslint-disable-line no-restricted-syntax
    const matchedValues = format.match(versionString);
    if (matchedValues.length > 0) {
      return format.extract(matchedValues);
    }
  }

  return null;
};

/**
 * @param {FirmwarePlatformIdEnum} platformId
 * @param {string} semver
 * @param {string} compileDate
 * @param {string} ext
 * @return {string} Canonical firmware filename.
 */
const buildFirmwareFilename = ({ platformId, semver, compileDate, ext }) =>
  `${platformId}-${semver}.${compileDate}.${ext}`;

const parseUbntProductToPlatformId = product => getOr(product, product, UBNT_PRODUCT_TO_PLATFORM_ID_MAP);

module.exports = {
  UnknownFirmwareImage,
  MismatchMD5FirmwareImage,
  parsePlatformTypeToId,
  parseVersion,
  buildFirmwareFilename,
  parseUbntProductToPlatformId,
};
