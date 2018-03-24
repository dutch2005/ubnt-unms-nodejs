'use strict';

const { merge } = require('lodash/fp');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {CorrespondenceAirMaxInfo} cmData
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeAirMaxInfo = (cmDiscoveryDevice, cmData) => {
  if (cmData === null) { return cmDiscoveryDevice }

  return merge(cmDiscoveryDevice, {
    name: cmData.name,
    firmwareVersion: cmData.firmwareVersion,
    firmware: cmData.firmware,
  });
};

/**
 * @param {Object.<string, string|number>} newConfiguration
 * @param {Object.<string, string|number>} cmData
 * @return {Object.<string, string|number>}
 */
const mergeConfiguration = (newConfiguration, cmData) => merge(cmData, newConfiguration);

module.exports = { mergeAirMaxInfo, mergeConfiguration };
