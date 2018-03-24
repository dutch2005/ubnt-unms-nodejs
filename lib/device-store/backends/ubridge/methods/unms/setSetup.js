'use strict';

const { constant } = require('lodash/fp');

const { rpcRequest } = require('../../messages');
const { DeviceTransmissionProfileSettingsEnum } = require('../../../../../enums');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDeviceSettings} settings
 * @return {Observable.<string>}
 */
function setSetup(settings) {
  return this.connection.rpc(rpcRequest({
    pingHost: settings.devicePingAddress,
    pingIntervalWhenUp: settings.devicePingIntervalNormal,
    pingIntervalWhenDown: settings.devicePingIntervalOutage,
    eventIntervalLimits: DeviceTransmissionProfileSettingsEnum[settings.deviceTransmissionProfile].eventIntervalLimits,
  }, 'unmsSetup', 'sys'));
}

module.exports = constant(setSetup);
