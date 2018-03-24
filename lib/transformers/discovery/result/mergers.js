'use strict';

const { assign } = require('lodash/fp');

const mergeWithDiscoveryDeviceList = (cmDiscoveryDeviceList, cmData) => assign(cmData, {
  devices: cmDiscoveryDeviceList,
});

module.exports = {
  mergeWithDiscoveryDeviceList,
};
