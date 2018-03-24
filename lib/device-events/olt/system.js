'use strict';

const { assocPath } = require('ramda');
const { flow } = require('lodash');

const config = require('../../../config');
const { DB } = require('../../db');
const { collectForDevice } = require('../../statistics');
const store = require('../../store');
const { logDeviceProperties } = require('../../device-log');
const { DevicePropertyEnum, StatusEnum } = require('../../enums');
const { formatHwTemperatures } = require('../utils');

function run(event) {
  const now = Date.now();

  return DB.olt.findById(event.id).then((dbOlt) => {
    if (dbOlt) {
      const systemStatus = event.payload;
      const cpu = parseInt(systemStatus.cpu, 10);
      const ram = parseInt(systemStatus.mem, 10);
      const ping = systemStatus.ping ? parseInt(systemStatus.ping.latency, 10) : 0;
      const errors = systemStatus.ping ? parseInt(systemStatus.ping.failureRate, 10) : 0;
      const uptime = parseInt(systemStatus.uptime, 10);
      const temps = formatHwTemperatures(systemStatus.temps);

      // device event log
      logDeviceProperties(store, dbOlt, now, {
        [DevicePropertyEnum.Cpu]: cpu,
        [DevicePropertyEnum.Ram]: ram,
      });

      // overview
      const newOlt = flow(
        assocPath(['overview', 'uptime'], uptime),
        assocPath(['overview', 'lastSeen'], Date.now()),
        assocPath(['overview', 'cpu'], cpu),
        assocPath(['overview', 'ram'], ram),
        assocPath(['overview', 'temps'], temps),
        assocPath(['overview', 'status'], dbOlt.identification.authorized
          ? StatusEnum.Active : StatusEnum.Unauthorized)
      )(dbOlt);

      // statistics
      const updateStatistics = collectForDevice(event.id, {
        timestamp: new Date(now).setMilliseconds(0),
        weight: 1,
        stats: {
          ram,
          cpu,
          ping,
          errors,
        },
      }).run({ DB, config });

      const updateOlt = DB.olt.update(newOlt);
      return Promise.all([updateStatistics, updateOlt]);
    }
    throw Error(`Missing olt (system) id in event: ${event.type}`);
  });
}

const systemHandler = ({ deviceId, payload }) => {
  const event = { id: deviceId, type: 'system', device: { stats: { } }, payload };

  return run(event);
};

module.exports = systemHandler;
