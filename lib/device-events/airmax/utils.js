'use strict';

const { Either } = require('monet');

const { toDb: toDbDevice } = require('../../transformers/device');
const { mergeInterfaces } = require('../../transformers/device/mergers');
const { toDbInterfaceList } = require('../../transformers/interfaces');
const { merge: mergeM } = require('../../transformers');

/**
 * @function toDbAirMax
 * @param {CorrespondenceDevice} cmAirMax
 * @return {Either.<DbDevice>}
 */
const toDbAirMax = cmAirMax => Either.of(cmAirMax)
  .chain(mergeM(mergeInterfaces, toDbInterfaceList(cmAirMax.interfaces)))
  .chain(toDbDevice);

module.exports = {
  toDbAirMax,
};
