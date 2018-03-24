'use strict';

const { flow, toPairs, map, join, sortBy, first } = require('lodash/fp');

const { liftMapper } = require('../../../index');

/**
 * @function toConfigurationFile
 * @param {Object.<string, string|number>} cmData
 * @return {string}
 */
const toConfigurationFile = flow(
  toPairs,
  sortBy(first),
  map(join('=')),
  join('\n')
);

module.exports = {
  toConfigurationFile,

  safeToConfigurationFile: liftMapper(toConfigurationFile),
};
