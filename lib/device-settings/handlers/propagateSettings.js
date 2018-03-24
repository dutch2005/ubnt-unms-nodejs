'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');

const CONCURRENCY = 10;

module.exports = ({ deviceId }, message) => reader(
  ({ deviceSettings, deviceStore, settings, messageHub }) => {
    const isUpdated = deviceSettings.updateSettings();

    if (!isUpdated) {
      return;
    }
    const {
      devicePingAddress, devicePingIntervalNormal, devicePingIntervalOutage, deviceTransmissionProfile,
    } = settings.getSettings();

    const unmsSettings = {
      devicePingAddress,
      devicePingIntervalNormal,
      devicePingIntervalOutage,
      deviceTransmissionProfile,
    };

    Observable.from(deviceStore.findAll())
      .filter(commDevice => !deviceSettings.hasOverride(commDevice.deviceId))
      .mergeMap(commDevice => commDevice.setSetup(unmsSettings).catch(() => Observable.empty()), CONCURRENCY)
      .subscribe({
        error(error) { messageHub.logError(message, error) },
      });
  }
);
