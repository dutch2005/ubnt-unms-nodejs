'use strict';

const { merge } = require('lodash/fp');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {CorrespondenceAirCubeInfo} cmData
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeAirCubeInfo = (cmDiscoveryDevice, cmData) => {
  if (cmData === null) { return cmDiscoveryDevice }

  return merge(cmDiscoveryDevice, {
    name: cmData.name,
    firmwareVersion: cmData.firmwareVersion,
    firmware: cmData.firmware,
  });
};

module.exports = { mergeAirCubeInfo };
