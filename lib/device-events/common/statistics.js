'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { isEmpty } = require('lodash/fp');

const statisticsHandler = ({ deviceId, payload: cmStats }) => reader(
  ({ DB, statistics }) => Observable.from(DB.device.exists(deviceId))
    .filter(Boolean)
    .mergeMap(() => {
      if (isEmpty(cmStats.interfaces)) {
        return statistics.collectForDevice(deviceId, cmStats);
      }

      if (isEmpty(cmStats.stats)) {
        return statistics.collectForInterfaces(deviceId, cmStats);
      }

      return statistics.collect(deviceId, cmStats);
    })
);

module.exports = statisticsHandler;
