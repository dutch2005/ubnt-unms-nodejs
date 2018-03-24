'use strict';

const { defaultTo } = require('lodash/fp');

class DeviceStore {
  constructor() {
    this.devices = new Map();
  }

  findAll(predicate = null) {
    if (predicate === null) {
      return Array.from(this.devices.values());
    }

    const results = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const commDevice of this.devices.values()) {
      if (predicate(commDevice)) { results.push(commDevice) }
    }

    return results;
  }

  exists(deviceId) {
    return this.devices.has(deviceId);
  }

  findById(deviceId) {
    return this.get(deviceId);
  }

  get(deviceId) {
    return defaultTo(null, this.devices.get(deviceId));
  }

  add(deviceId, commDevice) {
    commDevice.connection.log(`Adding device ${deviceId} to store`);
    if (this.devices.has(deviceId)) {
      this.remove(deviceId);
    }

    this.devices.set(deviceId, commDevice);
  }

  remove(deviceId) {
    const commDevice = this.get(deviceId);
    if (commDevice === null) { return }

    commDevice.connection.log(`Removing device ${deviceId} from store`);
    this.devices.delete(deviceId);
  }
}

module.exports = DeviceStore;
