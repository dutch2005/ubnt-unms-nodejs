'use strict';

const { Observable } = require('rxjs/Rx');
const crypto = require('crypto');
const { isNotUndefined, assoc } = require('ramda-adjunct');

const { fromDbList } = require('../transformers/mac-aes-key');

const { MacAesKeyExchangeStatusEnum } = require('../enums');
const { mac2id } = require('../util');

const AES_KEY_LENGTH = 32;

/**
 * @file Store of mac and aesKey object in memory
 *
 * Communicates with dal macAesKeyRepository
 */

/**
 * @typedef {Object} MacAesKey
 * @property {string} id of device
 * @property {string} mac address of device eth0
 * @property {Buffer} key Aes
 * @property {MacAesKeyExchangeStatusEnum|string} exchangeStatus
 */

class MacAesKeyStore {
  constructor(dal, logger) {
    this.logger = logger;
    this.macMap = new Map();
    this.deviceIdMap = new Map();
    this.repository = dal.macAesKeyRepository;
  }

  /**
   * @return {Promise.<void>}
   */
  initialize() {
    return Observable.from(this.repository.findAll())
      .mergeEither(fromDbList({}))
      .do((cmMacAesKeys) => {
        this.macMap.clear();
        this.deviceIdMap.clear();

        cmMacAesKeys.forEach((cmMacAesKey) => {
          this.macMap.set(cmMacAesKey.mac, cmMacAesKey);
          this.deviceIdMap.set(cmMacAesKey.id, cmMacAesKey);
        });
      })
      .toPromise();
  }

  /**
   * @param {string} mac address
   * @return {MacAesKey} macAesKey or undefined
   */
  findByMac(mac) {
    return this.macMap.get(mac);
  }

  /**
   * @param {UUID} id of device
   * @return {MacAesKey} macAesKey or undefined
   */
  findById(id) {
    return this.deviceIdMap.get(id);
  }

  /**
   * @param {string} macAddress
   * @param {string} ip
   * @param {string} model
   * @return {Observable.<MacAesKey>}
   */
  create(macAddress, ip, model) {
    const deviceId = mac2id(macAddress);
    const macAesKey = {
      id: deviceId,
      mac: macAddress,
      key: crypto.randomBytes(AES_KEY_LENGTH),
      ip,
      model,
      exchangeStatus: MacAesKeyExchangeStatusEnum.Pending,
    };

    return Observable.defer(() => this.repository.save(macAesKey))
      .mapTo(macAesKey)
      .do(() => {
        this.macMap.set(macAddress, macAesKey);
        this.deviceIdMap.set(deviceId, macAesKey);
      });
  }

  /**
   * @param {MacAesKey} macAesKey
   * @return {Observable.<MacAesKey>}
   */
  update(macAesKey) {
    return Observable.defer(() => this.repository.update(macAesKey))
      .mapTo(macAesKey)
      .do(() => {
        this.macMap.set(macAesKey.mac, macAesKey);
        this.deviceIdMap.set(macAesKey.id, macAesKey);
      });
  }

  /**
   * @param {string} mac
   * @param {MacAesKeyExchangeStatusEnum} exchangeStatus
   * @return {Observable.<MacAesKey>}
   */
  updateStatus(mac, exchangeStatus) {
    return this.update(Object.assign({}, this.findByMac(mac), { exchangeStatus }));
  }

  /**
   * @param {string} mac
   * @param {Date} lastSeen
   * @return {Observable.<MacAesKey>}
   */
  updateLastSeen(mac, lastSeen = new Date()) {
    return this.update(assoc('lastSeen', lastSeen, this.findByMac(mac)));
  }

  /**
   * @param {UUID} id of device
   * @return {Promise.<void>}
   */
  remove(id) {
    return this.repository.remove(id)
      .then(() => {
        const key = this.findById(id);
        if (isNotUndefined(key)) {
          this.macMap.delete(key.mac);
          this.deviceIdMap.delete(id);
        }
      });
  }
}

module.exports = { MacAesKeyStore };
