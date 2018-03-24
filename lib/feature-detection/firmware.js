'use strict';

const { invertBy, identity, has, __, getOr, endsWith } = require('lodash/fp');
const { Range } = require('semver');

const { parseCommFirmwareVersion } = require('../transformers/semver/parsers');
const { DeviceModelEnum, FirmwarePlatformIdEnum } = require('../enums');
const { compareSemver } = require('../util/semver');


// region Utils
/**
 * Uses custom test method
 */
class FirmwareVersionRange extends Range {
  static testSet(set, version) {
    for (let i = 0; i < set.length; i += 1) {
      if (!set[i].test(version)) { return false }
    }

    return true;
  }

  test(version) {
    for (let i = 0; i < this.set.length; i += 1) {
      if (FirmwareVersionRange.testSet(this.set[i], version)) { return true }
    }

    return false;
  }
}

const r = range => new FirmwareVersionRange(range);
// endregion

// eslint-disable-next-line max-len
const AIRMAX_M_MIN_VERSIONS = r('6.1.3-cs || >=6.1.3');
const AIRMAX_AC_MIN_VERSIONS = r('8.4.3-cs || >=8.4.3');

/**
 * @type {Object.<string, string>}
 */
const MINIMUM_SUPPORTED_FIRMWARE_VERSIONS = {
  // - ONU
  [FirmwarePlatformIdEnum.NanoG]: r('>=1.0.1'),
  [FirmwarePlatformIdEnum.Loco]: r('>=0.0.1'), // TODO(karel.kristal@ubnt.com): amend min.version
  // - OLT
  [FirmwarePlatformIdEnum.E600]: r('>=1.0.0'),
  // - EdgeRouter
  [FirmwarePlatformIdEnum.E50]: r('>1.9.6'),
  [FirmwarePlatformIdEnum.E100]: r('>1.9.6'),
  [FirmwarePlatformIdEnum.E200]: r('>1.9.6'),
  [FirmwarePlatformIdEnum.E1000]: r('>1.9.6'),
  [FirmwarePlatformIdEnum.E300]: r('>=1.9.8-alpha'),
  // - EdgeSwitch
  [FirmwarePlatformIdEnum.ESGH]: r('>1.7.2'),
  [FirmwarePlatformIdEnum.ESWH]: r('>1.7.2'),
  // - AirCube
  [FirmwarePlatformIdEnum.ACB]: r('>=0.9.0'),
  // - AirMax M devices
  [FirmwarePlatformIdEnum.XM]: AIRMAX_M_MIN_VERSIONS,
  [FirmwarePlatformIdEnum.XW]: AIRMAX_M_MIN_VERSIONS,
  [FirmwarePlatformIdEnum.TI]: AIRMAX_M_MIN_VERSIONS,
  [FirmwarePlatformIdEnum.AirGW]: r('*'),
  [FirmwarePlatformIdEnum.AirGWP]: r('*'),
  // - AirMax AC devices
  [FirmwarePlatformIdEnum.WA]: AIRMAX_AC_MIN_VERSIONS,
  [FirmwarePlatformIdEnum.WA2]: r('*'),
  [FirmwarePlatformIdEnum.XC]: AIRMAX_AC_MIN_VERSIONS,
  [FirmwarePlatformIdEnum.XC2]: r('*'),
};

/**
 * @type {Array.<[string, string]>}
 */
const MODEL_PLATFORM_ID_PAIRS = [
  // - ONU
  [DeviceModelEnum.NanoG, FirmwarePlatformIdEnum.NanoG],
  [DeviceModelEnum.Loco, FirmwarePlatformIdEnum.Loco],
  // - OLT
  [DeviceModelEnum.UFOLT, FirmwarePlatformIdEnum.E600],
  [DeviceModelEnum.UFOLT4, FirmwarePlatformIdEnum.E600],
  // - EdgeRouter
  [DeviceModelEnum.ERX, FirmwarePlatformIdEnum.E50],
  [DeviceModelEnum.ERXSFP, FirmwarePlatformIdEnum.E50],
  [DeviceModelEnum.ERLite3, FirmwarePlatformIdEnum.E100],
  [DeviceModelEnum.ERPoe5, FirmwarePlatformIdEnum.E100],
  [DeviceModelEnum.ERPro8, FirmwarePlatformIdEnum.E200],
  [DeviceModelEnum.ER8, FirmwarePlatformIdEnum.E200],
  [DeviceModelEnum.ER8XG, FirmwarePlatformIdEnum.E1000],
  [DeviceModelEnum.ER4, FirmwarePlatformIdEnum.E300],
  [DeviceModelEnum.ER6P, FirmwarePlatformIdEnum.E300],
  // - EdgePoint
  [DeviceModelEnum.EPR6, FirmwarePlatformIdEnum.E50],
  [DeviceModelEnum.EPR8, FirmwarePlatformIdEnum.E200],
  [DeviceModelEnum.EPS16, FirmwarePlatformIdEnum.ESWH],
  // - EdgeSwitch
  [DeviceModelEnum.ES12F, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES16150W, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES24250W, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES24500W, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES24LITE, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES48500W, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES48750W, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES48LITE, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES8150W, FirmwarePlatformIdEnum.ESWH],
  [DeviceModelEnum.ES16XG, FirmwarePlatformIdEnum.ESGH],
  // - AirCube
  [DeviceModelEnum.ACBAC, FirmwarePlatformIdEnum.ACB],
  [DeviceModelEnum.ACBISP, FirmwarePlatformIdEnum.ACB],
  [DeviceModelEnum.ACBLOCO, FirmwarePlatformIdEnum.ACB],
  // - AirMax
  // - Rocket
  [DeviceModelEnum.R2N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R2T, FirmwarePlatformIdEnum.TI], [DeviceModelEnum.R2T, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.R5N, FirmwarePlatformIdEnum.XM], [DeviceModelEnum.R5N, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.R6N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R36GPS, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.RM3GPS, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R2NGPS, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R5NGPS, FirmwarePlatformIdEnum.XM], [DeviceModelEnum.R5NGPS, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.R9NGPS, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R5TGPS, FirmwarePlatformIdEnum.XW], [DeviceModelEnum.R5TGPS, FirmwarePlatformIdEnum.TI],
  [DeviceModelEnum.RM3, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R36, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.R9N, FirmwarePlatformIdEnum.XM],
  // - NanoStation
  [DeviceModelEnum.N2N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.N5N, FirmwarePlatformIdEnum.XM], [DeviceModelEnum.N5N, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N6N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.NS3, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.N36, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.N9N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.N9S, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.LM2, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.LM5, FirmwarePlatformIdEnum.XM], [DeviceModelEnum.LM5, FirmwarePlatformIdEnum.XW],
  // - Bullet
  [DeviceModelEnum.B2N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.B2T, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.B5N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.B5T, FirmwarePlatformIdEnum.XM],
  // - AirGrid
  [DeviceModelEnum.AG2, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.AG2HP, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.AG5, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.AG5HP, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.P2N, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.P5N, FirmwarePlatformIdEnum.XM],
  // - LiteStation
  [DeviceModelEnum.M25, FirmwarePlatformIdEnum.XM],
  // - PowerBeam
  [DeviceModelEnum.P2B400, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.P5B300, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.P5B400, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.P5B620, FirmwarePlatformIdEnum.XW],
  // - LiteBeam
  [DeviceModelEnum.LB5120, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.LB5, FirmwarePlatformIdEnum.XW],
  // - NanoBeam
  [DeviceModelEnum.N5B, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N5B16, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N5B19, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N5B300, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N5B400, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N5BClient, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N2B, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N2B13, FirmwarePlatformIdEnum.XW],
  [DeviceModelEnum.N2B400, FirmwarePlatformIdEnum.XW],
  // - PowerAP
  // supports only 5/10/20/40 channel widths
  [DeviceModelEnum.PAP, FirmwarePlatformIdEnum.XM],
  // - AirRouter
  [DeviceModelEnum.LAPHP, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.LAP, FirmwarePlatformIdEnum.XM],
  // - AirGateway
  // supports only 20/40 channel widths
  [DeviceModelEnum.AGW, FirmwarePlatformIdEnum.AirGW],
  [DeviceModelEnum.AGWLR, FirmwarePlatformIdEnum.AirGW],
  [DeviceModelEnum.AGWPro, FirmwarePlatformIdEnum.AirGWP],
  [DeviceModelEnum.AGWInstaller, FirmwarePlatformIdEnum.AirGWP],
  // - PowerBridge
  [DeviceModelEnum.PB5, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.PB3, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.P36, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.PBM10, FirmwarePlatformIdEnum.XM],
  // - NanoBridge
  [DeviceModelEnum.NB5, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.NB2, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.NB3, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.B36, FirmwarePlatformIdEnum.XM],
  [DeviceModelEnum.NB9, FirmwarePlatformIdEnum.XM],
  // - LiteStation
  [DeviceModelEnum.SM5, FirmwarePlatformIdEnum.XM],
  // - WispStation
  [DeviceModelEnum.WM5, FirmwarePlatformIdEnum.XM],
  // - ISO Station
  [DeviceModelEnum.ISM5, FirmwarePlatformIdEnum.XM],
  // AC devices
  // - NanoStation
  [DeviceModelEnum.NS5ACL, FirmwarePlatformIdEnum.XC], [DeviceModelEnum.NS5ACL, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.NS5AC, FirmwarePlatformIdEnum.WA],
  // - Rocket
  [DeviceModelEnum.R5ACPTMP, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.R5ACPTP, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.R5ACLite, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.R5ACPRISM, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.R2AC, FirmwarePlatformIdEnum.XC2],
  [DeviceModelEnum.RP5ACGen2, FirmwarePlatformIdEnum.XC],
  // - NanoBeam
  [DeviceModelEnum.NBE2AC13, FirmwarePlatformIdEnum.WA2],
  [DeviceModelEnum.NBE5AC16, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.NBE5AC19, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.NBE5ACGen2, FirmwarePlatformIdEnum.XC],
  // - PowerBeam
  [DeviceModelEnum.PBE5AC300, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.PBE5AC300ISO, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.PBE5AC400, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.PBE5AC400ISO, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.PBE5AC500, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.PBE5AC500ISO, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.PBE5AC620, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.PBE5AC620ISO, FirmwarePlatformIdEnum.XC],
  [DeviceModelEnum.PBE2AC400, FirmwarePlatformIdEnum.WA2],
  [DeviceModelEnum.PBE2AC400ISO, FirmwarePlatformIdEnum.WA2],
  [DeviceModelEnum.PBE5ACXGen2, null], // unknown
  [DeviceModelEnum.PBE5ACGen2, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.PBE5ACISOGen2, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.PBE5AC400ISOGen2, null], // unknown
  // - LiteBeam
  [DeviceModelEnum.LBE5AC16120, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.LBE5AC23, FirmwarePlatformIdEnum.WA],
  [DeviceModelEnum.LBE5ACGen2, FirmwarePlatformIdEnum.WA],
  // - ISO Station
  [DeviceModelEnum.IS5AC, FirmwarePlatformIdEnum.WA],
  // - PrismStation
  [DeviceModelEnum.PS5AC, FirmwarePlatformIdEnum.XC],
];

/**
 * @type {Object.<string, string[]>}
 */
const PLATFORM_ID_MODELS_MAP = MODEL_PLATFORM_ID_PAIRS.reduce((accumulator, [model, platform]) => {
  if (platform === null) { return accumulator }
  if (!has(platform, accumulator)) { accumulator[platform] = [] } // eslint-disable-line no-param-reassign
  accumulator[platform].push(model);
  return accumulator;
}, {});

const MODEL_PLATFORM_IDS_MAP = MODEL_PLATFORM_ID_PAIRS.reduce((accumulator, [model, platform]) => {
  if (platform === null) { return accumulator }
  if (!has(model, accumulator)) { accumulator[model] = [] } // eslint-disable-line no-param-reassign
  accumulator[model].push(platform);
  return accumulator;
}, {});

/**
 * @type {Object.<string, string>}
 */
const PLATFORM_ID_MAP = invertBy(identity, FirmwarePlatformIdEnum);

/**
 * @param {string} platformId
 * @return {boolean}
 */
const isAirMaxPlatformId = (platformId) => {
  switch (platformId) {
    case FirmwarePlatformIdEnum.XM:
    case FirmwarePlatformIdEnum.XW:
    case FirmwarePlatformIdEnum.TI:
    case FirmwarePlatformIdEnum.AirGW:
    case FirmwarePlatformIdEnum.AirGWP:
    case FirmwarePlatformIdEnum.WA:
    case FirmwarePlatformIdEnum.WA2:
    case FirmwarePlatformIdEnum.XC:
    case FirmwarePlatformIdEnum.XC2:
      return true;
    default:
      return false;
  }
};

/**
 * @param {string} platformId
 * @param {string} firmwareVersion
 * @return {boolean}
 */
const isFirmwareSupported = (platformId, firmwareVersion) => {
  if (has(platformId, MINIMUM_SUPPORTED_FIRMWARE_VERSIONS)) {
    const version = parseCommFirmwareVersion(firmwareVersion);

    if (version === null) { return false }

    const range = MINIMUM_SUPPORTED_FIRMWARE_VERSIONS[platformId];
    return range.test(version);
  }

  return false;
};

/**
 * AirMax firmware supporting custom scripts
 *
 * @param {string} platformId
 * @param {string} firmwareVersion
 * @return {boolean}
 */
const hasCustomScriptsSupport = (platformId, firmwareVersion) =>
  isAirMaxPlatformId(platformId) && endsWith('-cs', firmwareVersion);

/**
 * @function isPlatformIdSupported
 * @signature isPlatformIdSupported :: FirmwarePlatformIdEnum -> Boolean
 *                FirmwarePlatformIdEnum = String
 * @param {FirmwarePlatformIdEnum|string} platformId
 * @return {boolean}
 */
const isPlatformIdSupported = has(__, PLATFORM_ID_MAP);

/**
 * @function modelToPlatformIds
 * @signature modelToPlatformIds :: DeviceModelEnum -> FirmwarePlatformIds
 *                DeviceModelEnum = String
 *                FirmwarePlatformIds = Array.<String>
 * @param {DeviceModelEnum} model
 * @return {?FirmwarePlatformIdEnum[]}
 */
const modelToPlatformIds = getOr(null, __, MODEL_PLATFORM_IDS_MAP);

/**
 * @function modelsForPlatformId
 * @signature modelsForPlatformId :: FirmwarePlatformIdEnum -> DeviceModels
 *                DeviceModels = Array.<String>
 *                FirmwarePlatformIdEnum = String
 * @param {FirmwarePlatformIdEnum} product
 * @return {?DeviceModelEnum[]}
 */
const modelsForPlatformId = getOr(null, __, PLATFORM_ID_MODELS_MAP);

const supportedUbntProducts = new Set([
  'e50', 'e100', 'e200', 'e300', 'uf-olt', 'e1000', 'uf-nano', 'eswh', 'esgh',
  'XC', 'WA', 'TI', 'XM', 'XW', 'XCcs', 'WAcs', 'TIcs', 'XMcs', 'XWcs', 'ACB',
]);

const isUBNTSemverNewer = (storedFirmware, ubntFirmware) =>
  compareSemver(storedFirmware.semver.version, parseCommFirmwareVersion(ubntFirmware.version)) === -1;

module.exports = {
  isFirmwareSupported,
  isPlatformIdSupported,
  isAirMaxPlatformId,
  hasCustomScriptsSupport,
  modelToPlatformIds,
  modelsForPlatformId,
  supportedUbntProducts,
  isUBNTSemverNewer,

  // don't use directly, exported for tests only
  MINIMUM_SUPPORTED_FIRMWARE_VERSIONS,
  MODEL_PLATFORM_ID_PAIRS,
};
