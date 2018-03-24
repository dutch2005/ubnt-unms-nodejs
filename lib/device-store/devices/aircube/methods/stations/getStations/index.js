'use strict';

const { DeviceModelEnum } = require('../../../../../../enums');

const getStationsAC = require('./getStationsAC');
const getStationsISP = require('./getStationsISP');

module.exports = (sysInfo) => {
  if (sysInfo.model === DeviceModelEnum.ACBAC) {
    return getStationsAC;
  }

  return getStationsISP;
};
