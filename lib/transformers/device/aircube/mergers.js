'use strict';

const { merge } = require('lodash/fp');

const { StatusEnum } = require('../../../enums');

// mergeDbWithHw :: (Object, Object) -> CorrespondenceData
//     CorrespondenceData = Object
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
      ipAddress: hwDeviceCorrespondenceData.identification.ipAddress,
      updated: hwDeviceCorrespondenceData.identification.updated,
    },
    overview: {
      lastSeen: hwDeviceCorrespondenceData.overview.lastSeen,
      status: newStatus,
      gateway: hwDeviceCorrespondenceData.overview.gateway,
    },
    mode: hwDeviceCorrespondenceData.mode,
    aircube: hwDeviceCorrespondenceData.aircube,
    interfaces: hwDeviceCorrespondenceData.interfaces,
  });
};

module.exports = {
  mergeDbWithHw,
};
