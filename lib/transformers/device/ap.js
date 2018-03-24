'use strict';

const { curry, merge } = require('lodash/fp');
const { StatusEnum } = require('../../enums');


const deviceDisconnected = curry((timestamp, cmDevice) => merge(cmDevice, {
  overview: {
    status: StatusEnum.Disconnected,
    uptime: 0,
    lastSeen: timestamp,
    cpu: 0,
    ram: 0,
  },
}));


module.exports = {
  deviceDisconnected,
};
