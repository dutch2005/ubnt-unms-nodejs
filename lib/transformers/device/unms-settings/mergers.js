'use strict';

const { assocPath } = require('ramda');

/**
 * @param {ApiUnmsSettings} unmsSettingsCorrespondence
 * @param {dbDevice} dbDeviceCorrespondence
 * @return {dbDevice}
 */
// mergeDbDeviceUnmsSettings :: (Object, Object) -> DeviceCorrespondence
//     DeviceCorrespondence = Object
const mergeDbDeviceUnmsSettings = (unmsSettingsCorrespondence, dbDeviceCorrespondence) => assocPath(
  ['unmsSettings'], unmsSettingsCorrespondence, dbDeviceCorrespondence
);

module.exports = {
  mergeDbDeviceUnmsSettings,
};
