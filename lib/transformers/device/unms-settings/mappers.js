'use strict';

const { liftMapper } = require('../../index');

// toApiUnmsSettings :: Object -> ApiUnmsSettings
//     ApiUnmsSettings = Object
const toApiUnmsSettings = correspondenceData => ({
  overrideGlobal: correspondenceData.overrideGlobal,
  devicePingAddress: correspondenceData.devicePingAddress,
  devicePingIntervalNormal: correspondenceData.devicePingIntervalNormal,
  devicePingIntervalOutage: correspondenceData.devicePingIntervalOutage,
  deviceTransmissionProfile: correspondenceData.deviceTransmissionProfile,
});


module.exports = {
  toApiUnmsSettings,

  safeToApiUnmsSettings: liftMapper(toApiUnmsSettings),
};
