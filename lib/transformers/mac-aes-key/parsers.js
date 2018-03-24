'use strict';

const { partial } = require('lodash/fp');

const { liftParser } = require('../index');
const { StatusEnum } = require('../../enums');

/**
 * AES keys mapped by MAC addresses of devices(eth0)
 *
 * @typedef {Object} CorrespondenceMacAesKey
 * @property {string} id UUID of device
 * @property {string} mac of device
 * @property {string} key
 * @property {MacAesKeyExchangeStatusEnum|string} exchangeStatus
 */

/**
 * @param {Object} auxiliaries
 * @param {DbMacAesKey} dbMacAesKey
 * @return {CorrespondenceMacAesKey}
 */
const parseDbMacAesKey = (auxiliaries, dbMacAesKey) => ({
  id: dbMacAesKey.id,
  mac: dbMacAesKey.mac,
  key: dbMacAesKey.key,
  lastSeen: dbMacAesKey.lastSeen,
  exchangeStatus: dbMacAesKey.exchangeStatus,
  ip: dbMacAesKey.ip,
  model: dbMacAesKey.model,
});

/**
 * @param {Object} auxiliaries
 * @param {DbMacAesKey[]} dbMacAesKeyList
 * @return {CorrespondenceMacAesKey[]}
 */
const parseDbMacAesKeyList = (auxiliaries, dbMacAesKeyList) => dbMacAesKeyList
  .map(partial(parseDbMacAesKey, [auxiliaries]));

/**
 * @param {Object} auxiliaries
 * @param {DbMacAesKey} dbMacAesKey
 * @return {CorrespondenceMacAesKey}
 */
const castMacAesKeyToDevice = (auxiliaries, dbMacAesKey) => ({
  identification: {
    id: dbMacAesKey.id,
    name: dbMacAesKey.mac,
    model: null,
    site: null,
    ipAddress: dbMacAesKey.ip,
  },
  overview: {
    lastSeen: dbMacAesKey.lastSeen,
    status: StatusEnum.Unknown,
  },
  meta: {
    failedMessageDecryption: false,
    note: null,
  },
});


module.exports = {
  parseDbMacAesKey,
  parseDbMacAesKeyList,
  castMacAesKeyToDevice,

  safeParseDbMacAesKey: liftParser(parseDbMacAesKey),
  safeParseDbMacAesKeyList: liftParser(parseDbMacAesKeyList),
};
