'use strict';

/**
 * @typedef {Object} ApiSemver
 * @property {string} major
 * @property {string} minor
 * @property {string} patch
 * @property {Array.<string|number>} prerelease
 */

/**
 * @param {CorrespondenceSemver} correspondenceSemver
 * @return {?ApiSemver}
 */
const toApiSemver = (correspondenceSemver) => {
  if (correspondenceSemver === null) { return null }

  return {
    major: correspondenceSemver.major,
    minor: correspondenceSemver.minor,
    patch: correspondenceSemver.patch,
    prerelease: correspondenceSemver.prerelease,
    order: correspondenceSemver.order,
  };
};

module.exports = {
  toApiSemver,
};
