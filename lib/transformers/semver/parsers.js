'use strict';

const { Maybe } = require('monet');
const { replace } = require('ramda');
const semver = require('semver');
const {
  getOr, flow, has, trimChars, memoize, split, compact, take, join, defaultTo, toLower,
} = require('lodash/fp');

/**
 * @typedef {SemVer} CorrespondenceSemver
 * @property {string} order
 */

// prerelease string -> number (order) or zero (equal to stable)
const SPECIAL_PRERELEASES = {
  1: 1, // 1.9.1-1
  '1unms': 2, // 1.9.1-1unms
  hotfix: 1, // 1.9.7-hotfix
  cs: 0, // airmax firmwares with custom scripts
};

/**
 * Sortable semver
 *
 * @param {SemVer} v
 * @return {string}
 */
const parseSemverOrder = (v) => {
  const isSpecial = has(v.prerelease[0], SPECIAL_PRERELEASES);
  const special = getOr(0, v.prerelease[0], SPECIAL_PRERELEASES);
  const isStable = isSpecial || v.prerelease.length === 0;

  // compress major and minor together
  const majorMinor = (v.major << 16) | v.minor; // eslint-disable-line no-bitwise

  if (!isStable) {
    return `${majorMinor}.${v.patch}.${special}-${v.prerelease.join('.')}`;
  }

  if (isSpecial && v.prerelease.length > 1) {
    return `${majorMinor}.${v.patch}.${special}-${v.prerelease.slice(1).join('.')}`;
  }

  return `${majorMinor}.${v.patch}.${special}`;
};

/**
 * @param {string} rawSemver
 * @return {CorrespondenceSemver}
 */
const parseSemver = (rawSemver) => {
  const parsedVersion = semver.parse(rawSemver);
  if (parsedVersion !== null) {
    parsedVersion.order = parseSemverOrder(parsedVersion);
  }

  return parsedVersion;
};

/**
 * @param {SemVer} semverVersion
 * @return {boolean}
 */
const parseStableVersion = semverVersion => (
  semverVersion.prerelease.length === 0 ||
  has(semverVersion.prerelease[0], SPECIAL_PRERELEASES)
);

/**
 * @function sanitizePreRelease
 * @param {string} preRelease suffix
 * @return {string}
 */
const sanitizePreRelease = flow(
  toLower,
  // normalize prerelease, split number from name, strip leading zeroes
  replace(/(alpha|beta|rc)(\d+)/, (match, prerelease, number) => `${prerelease}.${Number(number)}`),
  replace(/[^a-z0-9-.]+/, '-'),
  split('-'),
  compact,
  take(2),
  join('-')
);

/**
 * @function sanitizePreRelease
 * @param {string} preRelease suffix
 * @return {string}
 */
const sanitizeVersionString = flow(
  replace(/\.[\w\d]+\.\d{6}.\d{4}$/, ''), // strip compile date
  replace(/^(EdgeRouter|Fiber)\.ER-e\d+/, ''), // strip EdgeOs prefix
  replace(
    /.*?(\d+)\.(\d+)(\.(\d+))?[^A-Za-z0-9]*(.*)/, // patch version can be optional
    (match, major, minor, _, patch, prerelease) =>
      `${major}.${minor}.${defaultTo(0, patch)}-${sanitizePreRelease(prerelease)}`
  ),
  trimChars('-_')
);

/**
 * @param {string} commFirmwareVersion
 * @return {?string}
 */
const parseCommFirmwareVersion = commFirmwareVersion => Maybe
  .fromNull(commFirmwareVersion)
  .map(sanitizeVersionString)
  .filter(semver.valid)
  .orSome(null);

module.exports = {
  parseCommFirmwareVersion: memoize(parseCommFirmwareVersion),

  parseSemver,
  parseStableVersion,
};
