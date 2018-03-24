'use strict';

const { constant } = require('lodash/fp');

const { FirmwarePlatformIdEnum } = require('../../../enums');

// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = constant(FirmwarePlatformIdEnum.ACB);

module.exports = {
  parsePlatformId,
};
