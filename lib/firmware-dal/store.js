'use strict';

/**
 * @file Store of firmware objects in memory
 *
 * Acts like a database
 */

const { defaultTo, isUndefined } = require('lodash/fp');
const BinarySortedArray = require('binary-sorted-array');
const { view, lte } = require('ramda');
const { lensEq } = require('ramda-adjunct');

const {
  firmwareComparator, firmwareIdLens, firmwareOriginLens, firmwarePlatformIdLens, firmwareDateLens,
} = require('./utils');

class FirmwaresStore {
  constructor() {
    this.firmwares = new BinarySortedArray([], firmwareComparator);
    this.firmwaresById = new Map();
    this.firmwaresByPlatform = new Map();
  }

  /**
   * @return {CorrespondenceFirmware[]}
   */
  findAll() {
    return this.firmwares.getArray();
  }

  /**
   * @param {string} firmwareId
   * @return {CorrespondenceFirmware}
   */
  findById(firmwareId) {
    return defaultTo(null, this.firmwaresById.get(firmwareId));
  }

  /**
   * @param {FirmwarePlatformIdEnum|string} platformId
   * @return {CorrespondenceFirmware[]}
   */
  findByPlatform(platformId) {
    const firmwares = defaultTo(null, this.firmwaresByPlatform.get(platformId));
    if (firmwares === null) { return null }
    return firmwares.getArray();
  }

  /**
   * @param {Number} timestamp
   * @return {Array.<CorrespondenceFirmware>}
   */
  findAddedAfter(timestamp) {
    return this.firmwares.getArray()
      .filter(fw => lte(timestamp, view(firmwareDateLens, fw)));
  }

  /**
   * @param {string} firmwareId
   * @return {CorrespondenceFirmware}
   */
  remove(firmwareId) {
    const firmware = this.findById(firmwareId);
    if (firmware !== null) {
      this.firmwares.remove(firmware);
      this.removeFromIndex(firmware);
    }

    return firmware;
  }

  /**
   * @param {string} origin
   * @return {void}
   */
  removeAll(origin) {
    this.firmwares.getArray()
      .filter(lensEq(firmwareOriginLens, origin))
      .map(view(firmwareIdLens))
      .forEach(firmwareId => this.remove(firmwareId));
  }

  /**
   * @param {CorrespondenceFirmware} firmware
   * @return {CorrespondenceFirmware}
   */
  save(firmware) {
    const firmwareId = view(firmwareIdLens, firmware);

    if (!this.firmwaresById.has(firmwareId)) {
      this.addToIndex(firmware);
      this.firmwares.insert(firmware);
    }

    return firmware;
  }

  /**
   * @param {CorrespondenceFirmware[]} firmwares
   * @return {void}
   */
  init(firmwares) {
    this.firmwares.clear();
    this.firmwaresById.clear();
    this.firmwaresByPlatform.clear();

    firmwares.forEach(firmware => this.save(firmware));
  }

  /**
   * @private
   * @param {CorrespondenceFirmware} firmware
   * @return {void}
   */
  addToIndex(firmware) {
    const firmwareId = view(firmwareIdLens, firmware);
    const platformId = view(firmwarePlatformIdLens, firmware);

    this.firmwaresById.set(firmwareId, firmware);

    let firmwaresForPlatform = this.firmwaresByPlatform.get(platformId);
    if (isUndefined(firmwaresForPlatform)) {
      firmwaresForPlatform = new BinarySortedArray([], firmwareComparator);
      this.firmwaresByPlatform.set(platformId, firmwaresForPlatform);
    }
    firmwaresForPlatform.insert(firmware);
  }

  /**
   * @private
   * @param {CorrespondenceFirmware} firmware
   * @return {void}
   */
  removeFromIndex(firmware) {
    const firmwareId = view(firmwareIdLens, firmware);
    const platformId = view(firmwarePlatformIdLens, firmware);

    this.firmwaresById.delete(firmwareId);

    const firmwaresForPlatform = this.firmwaresByPlatform.get(platformId);
    if (firmwaresForPlatform.array.length === 1) {
      this.firmwaresByPlatform.delete(platformId);
    } else {
      firmwaresForPlatform.remove(firmware);
    }
  }
}


module.exports = { FirmwaresStore };
