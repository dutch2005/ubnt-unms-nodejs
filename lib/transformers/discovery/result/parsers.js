'use strict';

const aguid = require('aguid');
const { getOr, get, partial } = require('lodash/fp');
const { nth } = require('ramda');

const { liftParser } = require('../../index');
const { ProgressStatusEnum, DiscoveryMethodEnum } = require('../../../enums');

/**
 * @typedef {Object} CorrespondenceDiscoveryResult
 * @property {string} id UUID
 * @property {string} userId UUID
 * @property {DiscoveryMethodEnum} method
 * @property {?string} ipRangeInput
 * @property {?Array.<IpRange>} ipRangeParsed
 * @property {?Array.<string>} ipList
 * @property {ProgressStatusEnum} status
 * @property {?string} error
 * @property {?CorrespondenceDiscoveryDevice[]} devices
 */

/**
 * @param {Object} auxiliaries
 * @param {DbDiscoveryResult} dbDiscoveryResult
 * @return {CorrespondenceDiscoveryResult}
 */
const parseDbDiscoveryResult = (auxiliaries, dbDiscoveryResult) => ({
  id: dbDiscoveryResult.id,
  userId: dbDiscoveryResult.userId,
  method: dbDiscoveryResult.method,
  ipRangeInput: dbDiscoveryResult.ipRangeInput,
  ipRangeParsed: dbDiscoveryResult.ipRangeParsed,
  ipList: dbDiscoveryResult.ipList,
  status: dbDiscoveryResult.status,
  error: dbDiscoveryResult.error,
  devices: null,
});

/**
 * @param {Object} auxiliaries
 * @param {DbDiscoveryResult[]} dbDiscoveryResultList
 * @return {CorrespondenceDiscoveryResult[]}
 */
const parseDbDiscoveryResultList = (auxiliaries, dbDiscoveryResultList) => dbDiscoveryResultList
  .map(partial(parseDbDiscoveryResult, [auxiliaries]));

/**
 * @param {Object} auxiliaries
 * @param {Object} payload
 * @return {{CorrespondenceDiscoveryResult}}
 */
const parseApiDiscoveryResultPayload = (auxiliaries, payload) => {
  let discoveryResultPayload = {
    id: aguid(),
    userId: auxiliaries.userId,
    method: payload.method,
    ipRangeInput: getOr(null, 'input', payload.range),
    ipRangeParsed: getOr(null, 'parsed', payload.range),
    ipList: Array.isArray(payload.list) ? payload.list.map(get('ip')) : null,
    status: ProgressStatusEnum.InProgress,
    devices: null,
  };

  if (payload.single) {
    discoveryResultPayload = Object.assign({}, discoveryResultPayload, {
      method: DiscoveryMethodEnum.IpRange,
      ipRangeInput: Array.isArray(payload.list) ? nth(0, payload.list.map(get('ip'))) : null,
      ipRangeParsed: Array.isArray(payload.list) ? [{ type: 'single', ip: nth(0, payload.list.map(get('ip'))) }] : null,
    });
  }

  return discoveryResultPayload;
};

module.exports = {
  parseDbDiscoveryResult,
  parseDbDiscoveryResultList,
  parseApiDiscoveryResultPayload,

  safeParseDbDiscoveryResult: liftParser(parseDbDiscoveryResult),
  safeParseDbDiscoveryResultList: liftParser(parseDbDiscoveryResultList),
  safeParseApiDiscoveryResultPayload: liftParser(parseApiDiscoveryResultPayload),
};
