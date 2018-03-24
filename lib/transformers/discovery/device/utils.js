'use strict';

const { forEach, noop, isUndefined } = require('lodash/fp');

const { META_KEY } = require('../../index');
const { fromDeviceCorrespondence } = require('../../device/mac-address');
const { fromDbList: fromDbInterfacesList } = require('../../interfaces');

/**
 * @param {Map} accumulator
 * @param {CorrespondenceDevice} cmDevice
 * @return {*}
 */
const indexByMacAddress = (accumulator, cmDevice) => {
  if (isUndefined(cmDevice[META_KEY])) { return accumulator }

  const dbInterfaceList = cmDevice.interfaces;
  const dbDevice = cmDevice[META_KEY].source;

  fromDbInterfacesList({ dbDevice }, dbInterfaceList)
    .chain(interfaceListCorrespondence => fromDeviceCorrespondence({ interfaceListCorrespondence }, cmDevice))
    .cata(noop, forEach(mac => accumulator.set(mac, cmDevice)));
  return accumulator;
};

module.exports = {
  indexByMacAddress,
};
