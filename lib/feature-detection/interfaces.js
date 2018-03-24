'use strict';

const { memoize, T } = require('lodash/fp');
const { anyPass } = require('ramda');

const { DeviceModelEnum } = require('../enums');
const { isBridgeInterfaceType, isPonInterfaceType, isSfpInterfaceType } = require('../transformers/interfaces/utils');

/**
 * @callback isInterfaceVisibleForModel
 * @param {string} name
 * @return {boolean}
 */

/**
 * @param {DeviceModelEnum|string} model
 * @return {isInterfaceVisibleForModel}
 */
const isInterfaceVisible = (model) => {
  switch (model) {
    case DeviceModelEnum.UFOLT:
    case DeviceModelEnum.UFOLT4:
      return anyPass([isBridgeInterfaceType, isPonInterfaceType, isSfpInterfaceType]);
    default:
      return T;
  }
};

module.exports = {
  isInterfaceVisible: memoize(isInterfaceVisible),
};
