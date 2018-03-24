'use strict';

const { compose, noop } = require('lodash/fp');
const { lensPath, tryCatch } = require('ramda');
const { isNotNil } = require('ramda-adjunct');
const tmp = require('tmp');
const fs = require('fs');

const { compareSemver } = require('../util/semver');
const { parseCommFirmwareVersion } = require('../transformers/semver/parsers');

const firmwareIdentificationLens = lensPath(['identification']);
const firmwareSupportsLens = lensPath(['supports']);
const firmwareDateLens = lensPath(['date']);
const firmwareIdLens = compose(firmwareIdentificationLens, lensPath(['id']));
const firmwareFilenameLens = compose(firmwareIdentificationLens, lensPath(['filename']));
const firmwareOriginLens = compose(firmwareIdentificationLens, lensPath(['origin']));
const firmwareVersionLens = compose(firmwareIdentificationLens, lensPath(['version']));
const firmwarePlatformIdLens = compose(firmwareIdentificationLens, lensPath(['platformId']));
const firmwareDeviceModelsLens = compose(firmwareIdentificationLens, lensPath(['models']));
const firmwareHasCustomScriptsSupportLens = compose(firmwareSupportsLens, lensPath(['airMaxCustomScripts']));

/**
 * @return {Promise.<{ writeStream: Stream, cleanup: Function, filePath: string }>}
 */
const createTempFile = () => new Promise((resolve, reject) => {
  tmp.file({ keep: true }, (err, filePath, fd, cleanupCallback) => {
    if (isNotNil(err)) { return reject(err) }

    const cleanup = tryCatch(cleanupCallback, noop);
    const writeStream = fs.createWriteStream(filePath, { fd })
      .on('error', () => cleanup());
    return resolve({ writeStream, cleanup, filePath });
  });
});

/**
 * @param {CorrespondenceFirmware} a
 * @param {CorrespondenceFirmware} b
 * @return {number}
 */
const firmwareComparator = (a, b) => {
  const result = compareSemver(a.semver, b.semver);
  if (result === 0) {
    const idA = a.identification.id;
    const idB = b.identification.id;
    return idA < idB ? -1 : Number(idA > idB);
  }

  return result;
};

/**
 * @param {UBNTFirmware} a
 * @param {UBNTFirmware} b
 * @return {number}
 */
const firmwareUBNTComparator = (a, b) => {
  const semverA = parseCommFirmwareVersion(a.version);
  const semverB = parseCommFirmwareVersion(b.version);
  const result = compareSemver(semverA, semverB);
  if (result === 0) {
    const updatedA = new Date(a.updated);
    const updatedB = new Date(b.updated);
    return updatedA < updatedB ? -1 : Number(updatedA > updatedB);
  }

  return result;
};


module.exports = {
  firmwareIdLens,
  firmwareFilenameLens,
  firmwareDateLens,
  firmwareOriginLens,
  firmwareDeviceModelsLens,
  firmwarePlatformIdLens,
  firmwareVersionLens,
  firmwareHasCustomScriptsSupportLens,
  firmwareComparator,
  createTempFile,
  firmwareUBNTComparator,
};
