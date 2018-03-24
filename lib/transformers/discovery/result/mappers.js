'use strict';

const { when } = require('ramda');
const { isNotNull } = require('ramda-adjunct');

const { liftMapper } = require('../../index');
const { toApiDiscoveryDeviceList } = require('../device/mappers');

const toDbDiscoveryResult = correspondenceData => ({
  id: correspondenceData.id,
  userId: correspondenceData.userId,
  method: correspondenceData.method,
  ipRangeInput: correspondenceData.ipRangeInput,
  ipRangeParsed: correspondenceData.ipRangeParsed,
  ipList: correspondenceData.ipList,
  status: correspondenceData.status,
  error: correspondenceData.error,
});

/**
 * @typedef {Object} ApiDiscoveryResult
 * @property {Object} identification
 * @property {string} identification.id
 * @property {string} identification.method
 * @property {string} identification.ipRange
 * @property {?ApiDiscoveryDevice[]} devices
 * @property {string} userId
 * @property {string} status
 * @property {string} error
 */

/**
 * @param {CorrespondenceDiscoveryResult} correspondenceData
 * @return {ApiDiscoveryResult}
 */
const toApiDiscoveryResult = correspondenceData => ({
  identification: {
    id: correspondenceData.id,
    method: correspondenceData.method,
    ipRange: correspondenceData.ipRangeInput,
  },
  devices: when(isNotNull, toApiDiscoveryDeviceList, correspondenceData.devices),
  userId: correspondenceData.userId,
  status: correspondenceData.status,
  error: correspondenceData.error,
});

module.exports = {
  toApiDiscoveryResult,
  toDbDiscoveryResult,

  safeToApiDiscoveryResult: liftMapper(toApiDiscoveryResult),
  safeToDbDiscoveryResult: liftMapper(toDbDiscoveryResult),
};
