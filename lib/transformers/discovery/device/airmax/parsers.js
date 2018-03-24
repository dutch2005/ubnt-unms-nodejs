'use strict';

const { isNotUndefined, isNotString, isNotNull } = require('ramda-adjunct');
const { getOr, partial, flow, fromPairs } = require('lodash/fp');
const { when } = require('ramda');
const htmlEntities = require('html-entities').Html5Entities;

const { liftParser } = require('../../../index');
const { parseCommFirmwareVersion } = require('../../../semver/parsers');

/**
 * @typedef {Object} CorrespondenceAirMaxInfo
 * @property {string} name
 * @property {string} model
 * @property {string} firmwareVersion
 * @property {?DeviceFirmwareDetails} firmware
 */

const parseDeviceHostname = flow(
  getOr(null, ['host', 'hostname']),
  when(isNotNull, htmlEntities.decode)
);

/**
 * @param {Object} auxiliaries
 * @param {string} infoCmdOutput
 * @return {CorrespondenceAirMaxInfo}
 */
const parseInfoCommandOutput = (auxiliaries, infoCmdOutput) => {
  const { model, firmwareDal } = auxiliaries;
  const hostname = parseDeviceHostname(infoCmdOutput);
  const version = getOr(null, ['host', 'fwversion'], infoCmdOutput);

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

/**
 * @param {Object} auxiliaries
 * @param {string} value - string in format key=value
 * @return {string[]}
 */
const parseConfigurationValue = (auxiliaries, value) => {
  const splitPosition = value.indexOf('=');

  if (splitPosition >= 0) {
    return [value.substring(0, splitPosition), value.substring(splitPosition + 1)];
  }

  return [value, ''];
};

/**
 * @param {Object} auxiliaries
 * @param {String} configuration
 * @return {Object.<string, string|number>}
 */
const parseConfigurationFile = (auxiliaries, configuration) => {
  const configPairs = configuration
    .trim()
    .split('\n')
    .map(partial(parseConfigurationValue, [auxiliaries]));

  return fromPairs(configPairs);
};

module.exports = {
  parseInfoCommandOutput,
  parseConfigurationFile,

  safeParseInfoCommandOutput: liftParser(parseInfoCommandOutput),
  safeParseConfigurationFile: liftParser(parseConfigurationFile),
};
