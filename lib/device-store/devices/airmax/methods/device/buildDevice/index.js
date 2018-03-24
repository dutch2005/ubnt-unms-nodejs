'use strict';

const { isACSeries } = require('../../../../../../feature-detection/airmax');

const buildACDevice = require('./buildACDevice');
const buildMDevice = require('./buildMDevice');

module.exports = (sysInfo) => {
  if (isACSeries(sysInfo.model)) {
    return buildACDevice;
  }

  return buildMDevice;
};
