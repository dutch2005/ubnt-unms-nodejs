'use strict';

const { merge } = require('lodash/fp');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {CorrespondenceDiscoveryDeviceUpdate} cmData
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeEswitchDashboard = (cmDiscoveryDevice, cmData) => {
  if (cmData === null) { return cmDiscoveryDevice }

  return merge(cmDiscoveryDevice, {
    name: cmData.name,
    firmwareVersion: cmData.firmwareVersion,
    firmware: cmData.firmware,
  });
};


module.exports = { mergeEswitchDashboard };
