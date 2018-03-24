'use strict';

const { map } = require('lodash/fp');

const { liftMapper } = require('../index');
const { toApiSemver } = require('../semver/mappers');
const { firmwaresGuiUrl } = require('../../settings');

/**
 * @typedef {Object} ApiFirmware
 * @property {Object} identification
 * @property {string} identification.id
 * @property {string} identification.version
 * @property {boolean} identification.stable
 * @property {string} identification.filename
 * @property {FirmwareOriginEnum} identification.origin
 * @property {FirmwarePlatformIdEnum} identification.platformId
 * @property {Array.<DeviceModelEnum>} identification.models
 * @property {Object} supports
 * @property {boolean} supports.airMaxCustomScripts
 * @property {boolean} supports.UNMS
 * @property {ApiSemver} semver
 * @property {string} url
 * @property {number} size
 * @property {number} date Unix timestamp in milliseconds
 */

/**
 * @signature
 * toApiFirmware :: CorrespondenceFirmware -> ApiFirmware
 *    CorrespondenceFirmware = Object
 *    ApiFirmware = Object
 *
 * @param {CorrespondenceFirmware} correspondenceData
 * @return {ApiFirmware}
 */
const toApiFirmware = correspondenceData => ({
  identification: {
    id: correspondenceData.identification.id,
    version: correspondenceData.identification.version,
    stable: correspondenceData.identification.stable,
    filename: correspondenceData.identification.filename,
    origin: correspondenceData.identification.origin,
    platformId: correspondenceData.identification.platformId,
    models: correspondenceData.identification.models,
  },
  supports: {
    airMaxCustomScripts: correspondenceData.supports.airMaxCustomScripts,
    UNMS: correspondenceData.supports.UNMS,
  },
  semver: toApiSemver(correspondenceData.semver),
  url: `${firmwaresGuiUrl()}/${correspondenceData.url}`,
  size: correspondenceData.size,
  date: correspondenceData.date,
});

/**
 * @signature
 * toApiFirmwareList :: CorrespondenceFirmwareList -> ApiFirmwareList
 *    CorrespondenceFirmwareList = Array
 *    ApiFirmwareList = Array
 *
 * @function toApiList
 * @param {Array.<CorrespondenceFirmware>} correspondenceData
 * @return {Array.<ApiFirmware>}
 */
const toApiFirmwareList = map(toApiFirmware);

module.exports = {
  toApiSemver,
  toApiFirmware,
  toApiFirmwareList,

  safeToApi: liftMapper(toApiFirmware),
  safeToApiList: liftMapper(toApiFirmwareList),
};
