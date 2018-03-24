'use strict';

const { DeviceTypeEnum } = require('../enums');
const { deviceTypeFromModel } = require('./common');


/**
 * Statistics support
 *
 * @typedef {Object} DeviceStatisticsSupport
 * @property {boolean} cpu
 * @property {boolean} ram
 * @property {boolean} ping
 * @property {boolean} errors
 * @property {boolean} interfaces
 * @property {boolean} power
 * @property {boolean} signal
 */

/**
 * @param {string} model
 * @return {DeviceStatisticsSupport}
 */
const supportedStatistics = (model) => {
  const deviceType = deviceTypeFromModel(model);

  switch (deviceType) {
    case DeviceTypeEnum.Onu:
      return {
        cpu: true,
        ram: true,
        ping: false,
        errors: false,
        interfaces: true,
        power: true,
        signal: false,
        remoteSignal: false,
      };
    case DeviceTypeEnum.Olt:
    case DeviceTypeEnum.Erouter:
      return {
        cpu: true,
        ram: true,
        ping: true,
        errors: true,
        interfaces: true,
        power: false,
        signal: false,
        remoteSignal: false,
      };
    case DeviceTypeEnum.AirMax:
      return {
        cpu: true,
        ram: true,
        ping: true,
        errors: true,
        interfaces: true,
        power: false,
        signal: true,
        remoteSignal: true,
      };
    default:
      return {
        cpu: true,
        ram: true,
        ping: true,
        errors: true,
        interfaces: true,
        power: false,
        signal: false,
        remoteSignal: false,
      };
  }
};

module.exports = { supportedStatistics };
