'use strict';

const { isACSeries } = require('../../../../../../feature-detection/airmax');

const getStationsAC = require('./getStationsAC');
const getStationsM = require('./getStationsM');

module.exports = (sysInfo) => {
  if (isACSeries(sysInfo.model)) {
    return getStationsAC;
  }

  return getStationsM;
};
