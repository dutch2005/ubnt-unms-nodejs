'use strict';

const { Reader: reader } = require('monet');
const { includes, __ } = require('lodash/fp');
const { pathSatisfies } = require('ramda');
const { cata } = require('ramda-adjunct');

const { FirmwareOriginEnum } = require('../../../enums');
const { toApi, toApiList } = require('../../../transformers/firmwares');
const { rejectP, resolveP, allP } = require('../../../util');

const canDeleteFirmware = pathSatisfies(
  includes(__, [FirmwareOriginEnum.Manual, FirmwareOriginEnum.UBNT]),
  ['identification', 'origin']
);

/**
 * @return {Reader.<getFirmwares~callback>}
 */
const getFirmwares = () => reader(
  /**
   * @function getFirmwares~callback
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<ApiFirmware[]>}
   */
  ({ firmwareDal }) => toApiList(firmwareDal.findAll())
    .cata(rejectP, resolveP)
);

/**
 * @param {FirmwareOriginEnum} origin
 * @param {stream.Readable} fileStream
 * @return {Reader.<uploadFirmwareImage~callback>}
 */
const uploadFirmwareImage = (origin, fileStream) => reader(
  /**
   * @function uploadFirmwareImage~callback
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<ApiFirmware>}
   */
  ({ firmwareDal }) => firmwareDal.save(origin, fileStream)
    .then(toApi)
    .then(cata(rejectP, resolveP))
);

/**
 * @param {string[]} firmwareIds
 * @return {Reader.<removeFirmwares~callback>}
 */
const removeFirmwares = firmwareIds => reader(
  /**
   * @function removeFirmwares~callback
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<ApiFirmware[]>}
   */
  ({ firmwareDal }) => {
    const firmwaresToDelete = firmwareIds.map(firmwareDal.findById).filter(canDeleteFirmware);

    return allP(firmwaresToDelete.map(firmwareDal.remove))
      .then(toApiList)
      .then(cata(rejectP, resolveP));
  }
);

/**
 * @param {number} timestamp
 * @return {Reader.<removeFirmwares~callback>}
 */
const countUnread = ({ timestamp }) => reader(
  /**
   * @function countUnread~callback
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<number>}
   */
  ({ firmwareDal }) => firmwareDal.countUnread(timestamp)
);

/**
 * @return {Reader.<getUbntFirmwares~callback>}
 */
const getUbntFirmwares = () => reader(
    /**
   * @function getUbntFirmwares~callback
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<ApiFirmware[]>}
   */
  ({ firmwareDal }) =>
    firmwareDal.downloadAndCleanUbntFirmwares()
      .toArray()
      .mergeEither(toApiList)
      .toPromise()
);


module.exports = {
  uploadFirmwareImage,
  getFirmwares,
  removeFirmwares,
  countUnread,
  getUbntFirmwares,
};
