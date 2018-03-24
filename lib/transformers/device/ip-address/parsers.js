'use strict';

const { curry } = require('ramda');
const { isNull, getOr } = require('lodash/fp');

const { DeviceTypeEnum } = require('../../../enums');
const { parseOltIpAddress } = require('../olt/parsers');
const { parseErouterIpAddress } = require('../erouter/parsers');
const { parseDbDevice } = require('../parsers');

// parseDeviceIpAddress :: Auxiliaries -> cmDevice -> [String|Null]
//     Auxiliaries = Object
//     cmDevice = Object
const parseDeviceIpAddress = curry((auxiliaries, cmDevice) => {
  const deviceType = getOr(null, ['identification', 'type'], cmDevice);

  if (isNull === deviceType) { return new Error('Missing type') }

  switch (deviceType) {
    case DeviceTypeEnum.Olt:
      return parseOltIpAddress(auxiliaries, cmDevice);
    case DeviceTypeEnum.Erouter:
      return parseErouterIpAddress(auxiliaries, cmDevice);
    case DeviceTypeEnum.AirMax:
      return new Error('Not implemented');
    case DeviceTypeEnum.AirCube:
      return new Error('Not implemented');
    default:
      return new Error('Unknown type');
  }
});

// parseDbDeviceIpAddress :: Auxiliaries -> dbDevice -> [String|Null]
//     Auxiliaries = Object
//     dbDevice = Object
const parseDbDeviceIpAddress = curry((auxiliaries, dbDevice) => {
  const cmDevice = parseDbDevice(auxiliaries, dbDevice);
  return parseDeviceIpAddress(auxiliaries, cmDevice);
});

module.exports = {
  parseDeviceIpAddress,
  parseDbDeviceIpAddress,
};

