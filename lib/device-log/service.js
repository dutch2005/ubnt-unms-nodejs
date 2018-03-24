'use strict';

const { Reader: reader } = require('monet');

const deviceLog = require('./index');

const saveDeviceLog = (time = Date.now()) => reader(
  ({ store }) => deviceLog.saveDeviceLog(store, time)
);

module.exports = {
  saveDeviceLog,
};
