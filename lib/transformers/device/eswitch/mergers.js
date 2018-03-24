'use strict';

const { merge } = require('lodash/fp');

const { StatusEnum } = require('../../../enums');

// mergeDbWithHw :: (Object, Object) -> DeviceCorrespondenceData
//     DeviceCorrespondenceData = Object
const mergeDbWithHw = (dbDeviceCorrespondenceData, hwDeviceCorrespondenceData) => {
  const newStatus = dbDeviceCorrespondenceData.identification.authorized ? StatusEnum.Active : StatusEnum.Unauthorized;

  return merge(dbDeviceCorrespondenceData, {
    identification: {
      mac: hwDeviceCorrespondenceData.identification.mac,
      name: hwDeviceCorrespondenceData.identification.name,
      model: hwDeviceCorrespondenceData.identification.model,
      type: hwDeviceCorrespondenceData.identification.type,
      category: hwDeviceCorrespondenceData.identification.category,
      firmwareVersion: hwDeviceCorrespondenceData.identification.firmwareVersion,
      platformId: hwDeviceCorrespondenceData.identification.platformId,
      ipAddress: hwDeviceCorrespondenceData.identification.ipAddress,
      updated: Date.now(),
    },
    overview: {
      lastSeen: hwDeviceCorrespondenceData.overview.lastSeen,
      status: newStatus,
    },
    mode: hwDeviceCorrespondenceData.mode,
  });
};

module.exports = {
  mergeDbWithHw,
};
