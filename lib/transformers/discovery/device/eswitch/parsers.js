'use strict';

const { isNotUndefined, isNotString } = require('ramda-adjunct');
const cheerio = require('cheerio');

const { liftParser } = require('../../../index');
const { parseCommFirmwareVersion } = require('../../../semver/parsers');

/**
 * @typedef {Object} CorrespondenceDiscoveryDeviceUpdate
 * @property {string} name
 * @property {string} model
 * @property {string} firmwareVersion
 * @property {?DeviceFirmwareDetails} firmware
 */

/**
 * @param {Object} auxiliaries
 * @param {string} dashboardHtml
 * @return {CorrespondenceErouterInfo}
 */
const parseDashboardHtml = (auxiliaries, dashboardHtml) => {
  const { model, firmwareDal } = auxiliaries;
  const $ = cheerio.load(dashboardHtml);

  const hostname = $('#sys_name').text();
  const version = $('#sw_version')
    .text()
    .replace(/\.\d+$/, ''); // strip build number

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
  parseDashboardHtml,

  safeParseDashboardHtml: liftParser(parseDashboardHtml),
};
