'use strict';

// TODO(michal.sedlak@ubnt.com): This is OLD code and has to be refactored
const { assocPath } = require('ramda');
const { flow } = require('lodash');

const config = require('../../../config');
const { resolveP } = require('../../util');
const { DB } = require('../../db');
const { collectForDevice } = require('../../statistics');
const store = require('../../store');
const { logDeviceProperties } = require('../../device-log');
const { DevicePropertyEnum, StatusEnum } = require('../../enums');
const { formatHwTemperatures } = require('../utils');

/*
 //EdgeRouter.ER-e50.v1.9.0.4901118.160804.1131 - edge router X
 {
 "system-stats":
 {
 "cpu": "8",
 "uptime": "1219270",
 "mem": "17"
 }
 }
 */
/*
 //EdgeRouter.ER-e200.v1.9.0.4901118.160804.1139 - edge router PRO
 {
 "system-stats":
 {
 "cpu": "0",
 "uptime": "535507",
 "mem": "3",
 "temps":
 {
 "Board (PHY)": "42",
 "CPU": "65",
 "PHY": "72",
 "Board (CPU)": "41"
 }
 }
 }
 */

const systemHandler = ({ deviceId, payload }) => {
  const now = Date.now();

  return DB.erouter.findById(deviceId)
    .then((dbErouter) => {
      if (!dbErouter) { return resolveP() }

      const systemStatus = payload;
      const cpu = parseInt(systemStatus.cpu, 10);
      const ram = parseInt(systemStatus.mem, 10);
      const ping = systemStatus.ping ? parseInt(systemStatus.ping.latency, 10) : 0;
      const errors = systemStatus.ping ? parseInt(systemStatus.ping.failureRate, 10) : 0;
      const uptime = parseInt(systemStatus.uptime, 10);
      const temps = formatHwTemperatures(systemStatus.temps);

      // device event log
      logDeviceProperties(store, dbErouter, now, {
        [DevicePropertyEnum.Cpu]: cpu,
        [DevicePropertyEnum.Ram]: ram,
      });

      // overview
      const newErouter = flow(
        assocPath(['overview', 'uptime'], uptime),
        assocPath(['overview', 'lastSeen'], Date.now()),
        assocPath(['overview', 'cpu'], cpu),
        assocPath(['overview', 'ram'], ram),
        assocPath(['overview', 'temps'], temps),
        assocPath(['overview', 'status'], dbErouter.identification.authorized
          ? StatusEnum.Active : StatusEnum.Unauthorized)
      )(dbErouter);

      // statistics
      const updateStatistics = collectForDevice(deviceId, {
        timestamp: new Date(now).setMilliseconds(0),
        weight: 1,
        stats: {
          ram,
          cpu,
          ping,
          errors,
        },
      }).run({ DB, config });

      const updateErouter = DB.erouter.update(newErouter);
      return Promise.all([updateStatistics, updateErouter]);
    });
};

module.exports = systemHandler;

