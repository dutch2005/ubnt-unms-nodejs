'use strict';

const { isNotUndefined, isNotString } = require('ramda-adjunct');

const { liftParser } = require('../../../index');
const { parseCommFirmwareVersion } = require('../../../semver/parsers');

/**
 * @typedef {Object} CorrespondenceErouterInfo
 * @property {string} name
 * @property {string} model
 * @property {string} firmwareVersion
 * @property {?DeviceFirmwareDetails} firmware
 */

/**
 * @param {Object} auxiliaries
 * @param {string} infoCmdOutput
 * @return {CorrespondenceErouterInfo}
 */
const parseInfoCommandOutput = (auxiliaries, infoCmdOutput) => {
  const { model, firmwareDal } = auxiliaries;
  const [hostname, version] = infoCmdOutput.split('\n', 2);

  if (isNotString(hostname) || isNotString(version)) { return null }

  const firmwareVersion = parseCommFirmwareVersion(version);
  return {
    name: hostname.trim(),
    model,
    firmwareVersion,
    firmware: isNotUndefined(firmwareDal)
      ? firmwareDal.findFirmwareDetails(model, firmwareVersion)
      : null,
  };
};

module.exports = {
  parseInfoCommandOutput,

  safeParseInfoCommandOutput: liftParser(parseInfoCommandOutput),
};
