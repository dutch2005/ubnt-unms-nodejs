'use strict';

const { isUndefined } = require('lodash/fp');
const semver = require('semver');

const { parseSemver } = require('../transformers/semver/parsers');

const compareSemver = (semverA, semverB) => {
  const a = semver.parse(isUndefined(semverA.order) ? parseSemver(semverA).order : semverA.order);
  const b = semver.parse(isUndefined(semverB.order) ? parseSemver(semverB).order : semverB.order);

  return a.compare(b);
};


module.exports = {
  compareSemver,
};
