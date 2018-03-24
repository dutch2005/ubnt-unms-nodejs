'use strict';

const { DeviceModelEnum } = require('../../../../../../enums');

const buildAC = require('./buildDeviceAC');
const buildISP = require('./buildDeviceISP');

module.exports = (sysInfo) => {
  if (sysInfo.model === DeviceModelEnum.ACBAC) {
    return buildAC;
  }

  return buildISP;
};
