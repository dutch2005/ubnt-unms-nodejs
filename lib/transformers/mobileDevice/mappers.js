'use strict';

const { liftMapper } = require('../index');

// toDbMobileDevice :: Object -> DbMobileDevice
//     DbMobileDevice = Object
const toDbMobileDevice = cmMobileDevice => ({
  id: cmMobileDevice.id,
  user_id: cmMobileDevice.userId,
  name: cmMobileDevice.name,
  platform: cmMobileDevice.platform,
  token: cmMobileDevice.deviceToken,
  device_key: cmMobileDevice.deviceKey,
});

module.exports = {
  toDbMobileDevice,

  safeToDbMobileDevice: liftMapper(toDbMobileDevice),
};
