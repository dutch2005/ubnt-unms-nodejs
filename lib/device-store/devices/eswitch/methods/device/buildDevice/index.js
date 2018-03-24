'use strict';

const buildDeviceLegacy = require('./buildDeviceLegacy');
const buildDevice$1d7d3 = require('./buildDevice-1.7.3');

module.exports = (sysInfo) => {
  if (sysInfo.firmwareVersion !== null) {
    return buildDevice$1d7d3;
  }

  return buildDeviceLegacy;
};
