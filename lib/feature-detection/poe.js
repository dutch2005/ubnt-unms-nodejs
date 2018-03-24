'use strict';

const { memoize } = require('lodash');

const { PoeOutputEnum, DeviceModelEnum } = require('../enums');


/* eslint-disable no-bitwise */
// toPoeOutput :: Number -> [PoeOutputEnum]
const toPoeOutput = memoize((capacity) => {
  const volts = [];

  if ((capacity & 1) === 1) { volts.push(PoeOutputEnum.OFF) }
  if ((capacity & 4) === 4) { volts.push(PoeOutputEnum.V24) }
  if ((capacity & 2) === 2) { volts.push(PoeOutputEnum.V48) }
  if ((capacity & 32) === 32) { volts.push(PoeOutputEnum.V24PAIR4) }
  if ((capacity & 8) === 8) { volts.push(PoeOutputEnum.V54PAIR4) }
  if ((capacity & 16) === 16) { volts.push(PoeOutputEnum.PASSTHROUGH) }

  return volts;
});
/* eslint-enable no-bitwise */

const POE_SUPPORT = {
  [DeviceModelEnum.ERX]: {
    eth0: toPoeOutput(0),
    eth1: toPoeOutput(0),
    eth2: toPoeOutput(0),
    eth3: toPoeOutput(0),
    eth4: toPoeOutput(17),
    eth5: toPoeOutput(-1),
  },
  [DeviceModelEnum.ER6P]: {
    eth0: toPoeOutput(5),
    eth1: toPoeOutput(5),
    eth2: toPoeOutput(5),
    eth3: toPoeOutput(5),
    eth4: toPoeOutput(5),
    eth5: toPoeOutput(0),
  },
  [DeviceModelEnum.ERXSFP]: {
    eth0: toPoeOutput(5),
    eth1: toPoeOutput(5),
    eth2: toPoeOutput(5),
    eth3: toPoeOutput(5),
    eth4: toPoeOutput(5),
    eth5: toPoeOutput(0),
    eth6: toPoeOutput(-1),
  },
  [DeviceModelEnum.ERPoe5]: {
    eth0: toPoeOutput(7),
    eth1: toPoeOutput(7),
    eth2: toPoeOutput(7),
    eth3: toPoeOutput(7),
    eth4: toPoeOutput(7),
    eth5: toPoeOutput(-1),
  },
  [DeviceModelEnum.ERPro8]: {
    eth0: toPoeOutput(0),
    eth1: toPoeOutput(0),
    eth2: toPoeOutput(0),
    eth3: toPoeOutput(0),
    eth4: toPoeOutput(0),
    eth5: toPoeOutput(0),
    eth6: toPoeOutput(0),
    eth7: toPoeOutput(0),
  },
  [DeviceModelEnum.EPR6]: {
    eth0: toPoeOutput(5),
    eth1: toPoeOutput(5),
    eth2: toPoeOutput(5),
    eth3: toPoeOutput(5),
    eth4: toPoeOutput(5),
    eth5: toPoeOutput(0),
    eth6: toPoeOutput(-1),
  },
  [DeviceModelEnum.EPR8]: {
    eth0: toPoeOutput(0),
    eth1: toPoeOutput(41),
    eth2: toPoeOutput(41),
    eth3: toPoeOutput(5),
    eth4: toPoeOutput(5),
    eth5: toPoeOutput(5),
    eth6: toPoeOutput(5),
    eth7: toPoeOutput(5),
    eth8: toPoeOutput(-1),
  },
};

module.exports = {
  toPoeOutput,
  POE_SUPPORT,
};
