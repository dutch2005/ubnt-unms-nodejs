'use strict';

const { Reader: reader } = require('monet');
const { when } = require('ramda');
const { isNotNull } = require('ramda-adjunct');
const { tap } = require('lodash/fp');

const { resolveP, rejectP, allP, entityExistsCheck } = require('../../../util');
const { EntityEnum } = require('../../../enums');

const { parseDbDeviceSiteId } = require('../../../transformers/device/parsers');
const { fromDb: fromDbDevice, toApiEswitchStatusDetail } = require('../../../transformers/device');
const { merge: mergeM } = require('../../../transformers');
const { mergeMetadata } = require('../../../transformers/device/mergers');
const { fromDb: fromDbDeviceMetadata } = require('../../../transformers/device/metadata');

/*
 * Eswitch detail.
 */

const eswitchDetail = eswitchId => reader(
  ({ DB, deviceStore, firmwareDal, dal }) => {
    const dbEswitchPromise = DB.eswitch.findById(eswitchId)
      .then(tap(entityExistsCheck(EntityEnum.Eswitch)));
    const dbSitePromise = dbEswitchPromise
      .then(parseDbDeviceSiteId)
      .then(when(isNotNull, DB.site.findById));
    const dbDeviceMetadataPromise = dal.deviceMetadataRepository.findById(eswitchId);

    return allP([dbSitePromise, dbEswitchPromise, dbDeviceMetadataPromise])
      .then(([dbSite, dbEswitch, dbDeviceMetadata]) =>
        fromDbDevice({ firmwareDal, deviceStore, dbSite }, dbEswitch)
          .chain(mergeM(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
          .chain(toApiEswitchStatusDetail)
          .cata(rejectP, resolveP));
  }
);

module.exports = {
  eswitchDetail,
};
