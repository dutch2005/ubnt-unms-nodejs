'use strict';

const { lensPath } = require('ramda');

const ospfAreaIdLens = lensPath(['0']);
const ospfAreaAuthLens = lensPath(['1', 'authentication']);
const ospfAreaNetworksLens = lensPath(['1', 'network']);

module.exports = {
  ospfAreaIdLens,
  ospfAreaAuthLens,
  ospfAreaNetworksLens,
};
