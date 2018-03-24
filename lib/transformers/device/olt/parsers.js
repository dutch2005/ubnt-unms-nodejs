'use strict';

const { getOr, flow, defaultTo, nth, toPairs, pick, invokeArgs } = require('lodash/fp');
const { match, pathOr, pathEq, path, equals, curry, map } = require('ramda');
const { Maybe } = require('monet');

const { liftParser } = require('../../index');
const { OnuModeEnum } = require('../../../enums');
const { defaultToWhen } = require('../../../util');
const { parseInterfaceListIpAddressCidr } = require('../../interfaces/parsers');

// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = flow(match(/ER-(e\d+)\./), nth(1), defaultTo(null));

/*
 * Type Definitions
 * ================
 *
 * The correspondence format definition below takes into account the latest proposal for OLT configuration
 * structure (which can be found here: https://ubiquiti.atlassian.net/wiki/pages/viewpage.action?pageId=157286709)
 * that contains features that are not implemented in current OLT firmware, namely restricting bandwidth rates and
 * ONU capabilities, namely functioning in router mode.
 */

/**
 * @typedef {Object} OnuProfileBridge
 * @prop {?number} nativeVlan
 * @prop {!Array.<Number>} includeVlans
 */

/**
 * @typedef {Object} OnuProfileRouter
 * @prop {?number} wanVlan
 * @prop {string} gateway
 * @prop {string} dnsResolver
 * @prop {string} lanAddress
 * @prop {string} dhcpPool
 * @prop {?string} unmsConnString
 */

/**
 * @typedef {Object} CorrespondenceOnuProfile
 * @prop {?string} id
 * @prop {string} name
 * @prop {string} mode
 * @prop {string} adminPassword
 * @prop {OnuProfileBridge} bridge
 * @prop {OnuProfileRouter} router
 */

/*
 * Currently parse bridge only => proposal not implemented
 */

// parseIncludeVlans :: HwBridge -> Array.<Number>
const parseIncludeVlans = flow(
  path(['port', '1', 'include-vlan']),
  defaultToWhen(equals(''), []),
  map(Number)
);

// parseIncludeVlans :: HwBridge -> Number|Null
const parseNativeVlan = flow(
  path(['port', '1', 'native-vlan']),
  defaultToWhen(equals(''), null),
  Maybe.fromNull,
  map(Number),
  invokeArgs('orSome', [null])
);

// parseHwOnuProfileBridge :: Object -> Object
const parseHwOnuProfileBridge = hwBridge => ({
  includeVlans: parseIncludeVlans(hwBridge),
  nativeVlan: parseNativeVlan(hwBridge),
});

// parseHwOnuProfile :: [ String, Object ] -> CorrespondenceOnuProfile
//    CorrespondenceOnuProfile = Object
const parseHwOnuProfile = hwOnuPair => ({
  id: pathOr(null, ['0'], hwOnuPair),
  name: pathOr(null, ['1', 'name'], hwOnuPair),
  mode: pathOr(null, ['1', 'mode'], hwOnuPair),
  adminPassword: pathOr(null, ['1', 'admin-password'], hwOnuPair),
  bridge: parseHwOnuProfileBridge(pathOr(null, ['1', 'bridge-mode'], hwOnuPair)),
  router: null,
});

// parseHwOnuProfileList :: (Auxiliaries, hwOnuProfiles) -> Array.<Object>
//    auxiliaries   = Object
//    hwOnuProfiles = Object
const parseHwOnuProfileList = (auxiliaries, hwOnuProfiles) => flow(
  toPairs,
  map(parseHwOnuProfile)
)(hwOnuProfiles);

// parseHwOnu :: hwOnu -> Object
//    hwOnu = Object
const parseHwOnu = hwOnu => ({
  name: pathOr(null, ['1', 'name'], hwOnu),
  profile: pathOr(null, ['1', 'profile'], hwOnu),
  enabled: pathEq(['1', 'disable'], 'false', hwOnu),
});

// parseHwOnuList :: (Auxiliaries, HwOnuList) -> Array.<Object>
//    Auxiliaries = Object
//    HwOnuList   = Object
const parseHwOnuList = (auxiliaries, hwOnuList) => flow(
  toPairs,
  map(parseHwOnu)
)(hwOnuList);

// parseApiOnuProfile :: (Auxiliaries, ApiOnuProfile) -> Object
//    Auxiliaries = Object
//    ApiOnuProfile = Object
const parseApiOnuProfile = (auxiliaries, apiOnuProfile) => ({
  id: getOr(null, 'id', apiOnuProfile),
  name: apiOnuProfile.name,
  mode: apiOnuProfile.mode,
  adminPassword: apiOnuProfile.adminPassword,
  bridge: apiOnuProfile.mode === OnuModeEnum.Bridge ? {
    nativeVlan: getOr(null, ['bridge', 'nativeVlan'], apiOnuProfile),
    includeVlans: getOr(null, ['bridge', 'includeVlans'], apiOnuProfile),
  } : null,
  router: apiOnuProfile.mode === OnuModeEnum.Router ? {
    ingressRate: getOr(null, ['router', 'ingressRate'], apiOnuProfile),
    egressRate: getOr(null, ['router', 'egressRate'], apiOnuProfile),
    wanVlan: getOr(null, ['router', 'wanVlan'], apiOnuProfile),
    gateway: getOr(null, ['router', 'gateway'], apiOnuProfile),
    dnsResolver: getOr(null, ['router', 'dnsResolver'], apiOnuProfile),
    dhcpPool: getOr(null, ['router', 'dhcpPool'], apiOnuProfile),
    unmsConnString: getOr(null, ['router', 'unmsConnString'], apiOnuProfile),
  } : null,
});

// parseHwOnuPolicies :: (Auxiliaries, HwOnuPolicies) => Object
//    Auxiliaries   = Object
//    HwOnuPolicies = Object
const parseHwOnuPolicies = (auxiliaries, hwOnuPolicies) => ({
  defaultState: pathOr(null, ['default-state'], hwOnuPolicies),
});

// parseApiOnuPolicies :: (Auxiliaries, ApiOnuPolicies) => Object
//    Auxiliaries   = Object
//    ApiOnuPolicies = Object
const parseApiOnuPolicies = (auxiliaries, apiOnuPolicies) => pick(['defaultState'], apiOnuPolicies);

// parseOltIpAddress :: Auxiliaries -> CorrespondenceData -> IpAddress
//    Auxiliaries        = Object
//    CorrespondenceData = Object
//    IpAddress          = String
const parseOltIpAddress = curry((auxiliaries, olt) =>
  parseInterfaceListIpAddressCidr({ gateway: getOr(null, ['overview', 'gateway'], olt) }, olt.interfaces)
);


module.exports = {
  parsePlatformId,
  parseOltIpAddress,

  safeParseOltIpAddress: liftParser(parseOltIpAddress),

  parseHwOnuProfileList,
  parseApiOnuProfile,
  parseHwOnuList,

  safeParseHwOnuProfileList: liftParser(parseHwOnuProfileList),
  safeParseApiOnuProfile: liftParser(parseApiOnuProfile),
  safeParseHwOnuList: liftParser(parseHwOnuList),

  parseHwOnuPolicies,
  parseApiOnuPolicies,

  safeParseHwOnuPolicies: liftParser(parseHwOnuPolicies),
  safeParseApiOnuPolicies: liftParser(parseApiOnuPolicies),
};
