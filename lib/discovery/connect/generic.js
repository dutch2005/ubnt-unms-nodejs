'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { getOr } = require('lodash/fp');

const { DiscoveryConnectProgressEnum } = require('../../enums');
const { isFirmwareSupported, hasCustomScriptsSupport } = require('../../feature-detection/firmware');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Function}
 */
const firmwareSelector = (cmDiscoveryDevice) => {
  const useUnstableFirmware = getOr(false, 'useUnstableFirmware', cmDiscoveryDevice.preferences);
  const customScriptsSupport = hasCustomScriptsSupport(cmDiscoveryDevice.platformId, cmDiscoveryDevice.firmwareVersion);

  if (useUnstableFirmware && !customScriptsSupport) { return null }

  /**
   * @param {CorrespondenceFirmware} firmware
   * @return {boolean}
   */
  return firmware => (useUnstableFirmware || firmware.identification.stable)
    && (!customScriptsSupport || firmware.supports.airMaxCustomScripts);
};

/**
 * @param {Function} upgradeStrategy
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Observable}
 */
const upgradeFirmwareIfNeeded = (upgradeStrategy, cmDiscoveryDevice) => reader(
  ({ firmwareDal, statusUpdater, connection }) => {
    if (isFirmwareSupported(cmDiscoveryDevice.platformId, cmDiscoveryDevice.firmwareVersion)) {
      return Observable.of(connection);
    }

    const firmware = firmwareDal.findLatestFirmware(cmDiscoveryDevice.platformId, firmwareSelector(cmDiscoveryDevice));

    if (firmware === null) {
      return Observable.throw(new Error('No compatible firmware available'));
    }

    return statusUpdater.updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.FirmwareUpgrade)
      .mergeMap(() => upgradeStrategy(firmware).run(connection));
  }
);

module.exports = { upgradeFirmwareIfNeeded };
