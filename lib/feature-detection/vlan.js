'use strict';

const { DeviceModelEnum } = require('../enums');


// isVlanCapableOnSwitch :: String -> Boolean
const isVlanCapableOnSwitch = (deviceModel) => {
  // TODO(vladimir.gorej@gmail.com): more proper implementation would be to know if deviceModel supports switch
  // TODO(vladimir.gorej@gmail.com): interface at all. When we have this feature detection in the future
  // TODO(vladimir.gorej@gmail.com): it should be used here before following switch.
  switch (deviceModel) {
    case DeviceModelEnum.EPR6:
    case DeviceModelEnum.ERX:
    case DeviceModelEnum.ERXSFP:
      return true;
    default:
      return false;
  }
};


module.exports = {
  isVlanCapableOnSwitch,
};
