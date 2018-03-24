'use strict';

const { Observable } = require('rxjs/Rx');
const { constant, isPlainObject } = require('lodash/fp');
const { allPass, pathSatisfies } = require('ramda');

const { deviceConfigRequest, interfaceMacAddressesRequest, deviceIpAddressRequest } = require('../../messages');
const {
  parseHwDevice, parseCmRoutes, parseHwInterfacesMacs, parseHwIpAddress,
} = require('../../transformers/device/parsers');
const { mergeDeviceUpdate } = require('../../../../../transformers/device/mergers');

const CONFIG_RETRY_DELAY = 1000;

const isValidDeviceConfig = allPass([
  pathSatisfies(isPlainObject, ['data', 'interfaces']),
  pathSatisfies(isPlainObject, ['data', 'service']),
  pathSatisfies(isPlainObject, ['data', 'system']),
]);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} cmDeviceStub
 * @return {Observable.<CorrespondenceDevice>}
 */
function buildDevice(cmDeviceStub) {
  const hasDeviceId = cmDeviceStub.identification.id !== null;

  // config might not be available after boot, retry until available
  const deviceConfig$ = this.connection.rpc(deviceConfigRequest())
    .first(isValidDeviceConfig)
    .retryWhen(errors => errors.delay(CONFIG_RETRY_DELAY));
  const routes$ = this.getRoutes().catch(() => Observable.of([]));
  const interfaceMacs$ = hasDeviceId ? Observable.of(null) : this.connection.cmd(interfaceMacAddressesRequest());
  const ipAddress$ = this.connection.cmd(deviceIpAddressRequest());

  return Observable.forkJoin(deviceConfig$, routes$, interfaceMacs$, ipAddress$)
    .map(([hwDeviceConfig, cmRoutes, hwInterfaceMacs, hwIpAddress]) => {
      let cmDevice = cmDeviceStub;

      if (!hasDeviceId) {
        cmDevice = mergeDeviceUpdate(cmDevice, parseHwInterfacesMacs({}, hwInterfaceMacs));
      }
      return mergeDeviceUpdate(
        cmDevice,
        parseHwDevice({ features: this.features }, hwDeviceConfig),
        parseCmRoutes({}, cmRoutes), // get gateway
        parseHwIpAddress({}, hwIpAddress)
      );
    });
}

module.exports = constant(buildDevice);
