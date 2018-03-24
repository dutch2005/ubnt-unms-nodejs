'use strict';

const { merge } = require('lodash/fp');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {CorrespondenceErouterInfo} cmData
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeErouterInfo = (cmDiscoveryDevice, cmData) => {
  if (cmData === null) { return cmDiscoveryDevice }

  return merge(cmDiscoveryDevice, {
    name: cmData.name,
    firmwareVersion: cmData.firmwareVersion,
    firmware: cmData.firmware,
  });
};


module.exports = { mergeErouterInfo };
