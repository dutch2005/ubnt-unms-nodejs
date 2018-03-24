'use strict';

const { liftEither } = require('../../index');
const { parseDbDeviceIpAddress, parseDeviceIpAddress } = require('./parsers');

module.exports = {
  fromDevice: liftEither(1, parseDeviceIpAddress),
  fromDbDevice: liftEither(1, parseDbDeviceIpAddress),
};
