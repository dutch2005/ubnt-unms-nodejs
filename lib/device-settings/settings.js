'use strict';

const { Observable } = require('rxjs/Rx');
const { getOr, isUndefined, isEqual } = require('lodash/fp');

const { fromDbDevice: fromDbDeviceUnmsSettings } = require('../transformers/device/unms-settings');
const { DeviceTransmissionProfileSettingsEnum } = require('../enums');

const DEFAULT_INTERVAL = 4000;

class DeviceSettings {
  constructor(settings, DB) {
    this.settings = settings;
    this.DB = DB;
    this.defaultSettings = {};
    this.profiles = new Map();

    this.updateSettings();
  }

  getInterval(deviceId, intervalName) {
    let profile = this.profiles.get(deviceId);
    if (isUndefined(profile)) {
      profile = this.settings.deviceTransmissionProfile();
    }

    return getOr(DEFAULT_INTERVAL, [intervalName], DeviceTransmissionProfileSettingsEnum[profile]);
  }

  /**
   * Whether or not the devices has it's own transmission profile
   *
   * @param {string} deviceId
   * @return {boolean}
   */
  hasOverride(deviceId) {
    return this.profiles.has(deviceId);
  }

  /**
   * @return {boolean} true if settings changed
   */
  updateSettings() {
    const {
      devicePingAddress, devicePingIntervalNormal, devicePingIntervalOutage, deviceTransmissionProfile,
    } = this.settings.getSettings();

    const newSettings = {
      devicePingAddress,
      devicePingIntervalNormal,
      devicePingIntervalOutage,
      deviceTransmissionProfile,
    };

    if (isEqual(this.defaultSettings, newSettings)) {
      return false;
    }

    this.defaultSettings = newSettings;
    return true;
  }

  /**
   * @param {string} deviceId
   * @return {Observable.<CorrespondenceDeviceSettings>}
   */
  loadSettings(deviceId) {
    return Observable.from(this.DB.device.findById(deviceId))
      .mergeEither(fromDbDeviceUnmsSettings)
      .catch(() => Observable.of({
        overrideGlobal: false,
      }))
      .map((unmsSettings) => {
        if (!unmsSettings.overrideGlobal) {
          this.profiles.delete(deviceId);
          return Object.assign({ overrideGlobal: false }, this.defaultSettings);
        }

        this.profiles.set(deviceId, unmsSettings.deviceTransmissionProfile);

        return unmsSettings;
      });
  }
}

module.exports = DeviceSettings;
