'use strict';

/**
 * @file Handles filesystem related tasks
 */

const { Reader: reader, Either } = require('monet');
const { isFunction, values, get, map, constant, flatten, invokeArgs, eq } = require('lodash/fp');
const { when, chain } = require('ramda');
const boom = require('boom');
const httpStatus = require('http-status');
const cloneable = require('cloneable-readable');
const pump = require('pump');
const path = require('path');
const fse = require('fs-extra');
const crypto = require('crypto');
const { isNotNull, isNotNil, cata } = require('ramda-adjunct');

const { resolveP, rejectP, allP } = require('../util');
const { FirmwareOriginEnum } = require('../enums');
const { UnknownFirmwareImage, MismatchMD5FirmwareImage } = require('./image-parser/common');
const { fromFile, fromFileList } = require('../transformers/firmwares');

const origins = values(FirmwareOriginEnum);

const handleError = (error) => {
  if (error instanceof UnknownFirmwareImage || error instanceof MismatchMD5FirmwareImage) {
    return rejectP(boom.wrap(error, httpStatus.UNPROCESSABLE_ENTITY));
  }

  return rejectP(error);
};

/**
 * @param {string} filePath
 * @return {Promise.<number>}
 */
const getFileSize = filePath => fse.stat(filePath)
  .then(get('size'))
  .catch(constant(0));

/**
 * @return {Reader.<load~callback>}
 */
const load = () => reader(
  /**
   * @function load~callback
   * @param {Function} firmwaresConfig
   * @return {Promise.<CorrespondenceFirmware[]>}
   */
  ({ firmwaresConfig }) => {
    const { dir } = firmwaresConfig();

    const filesByOrigin = origins.map((origin) => {
      const dirName = path.join(dir, origin);
      return fse.pathExists(dirName)
        .then(when(eq(false), () => fse.ensureDir(dirName)))
        .then(() => fse.readdir(dirName))
        .then(map(filename => getFileSize(path.join(dirName, filename))
          .then(size => ({ filename, origin, size }))))
        .then(allP);
    });

    return allP(filesByOrigin)
      .then(flatten)
      .then(fromFileList)
      .then(invokeArgs('cata', [rejectP, resolveP]));
  }
);

/**
 * @param {FirmwareOriginEnum|string} origin
 * @param {string} filename
 * @return {Reader.<remove~callback>}
 */
const remove = (origin, filename) => reader(
  /**
   * @function remove~callback
   * @param {Function} firmwaresConfig
   * @return {Promise.<void>}
   */
  ({ firmwaresConfig }) => {
    const { dir } = firmwaresConfig();
    const filePath = path.join(dir, origin, filename);
    return fse.unlink(filePath);
  }
);

/**
 * @param {FirmwareOriginEnum|string} origin
 * @return {Reader.<removeAll~callback>}
 */
const removeAll = origin => reader(
  /**
   * @function removeAll~callback
   * @param {Function} firmwaresConfig
   * @return {Promise.<void>}
   */
  ({ firmwaresConfig }) => {
    const { dir } = firmwaresConfig();
    const originDir = path.join(dir, origin);
    return fse.emptyDir(originDir);
  }
);

/**
 * @param {FirmwareOriginEnum|string} origin
 * @param {stream.Readable} fileStream
 * @param {?string} md5
 * @return {Reader.<save~callback>}
 */
const save = (origin, fileStream, md5 = null) => reader(
  /**
   * @function save~callback
   * @param {Function} firmwaresConfig
   * @param {Function} createTempFile
   * @param {firmwareImageParser} firmwareImageParser
   * @return {Promise.<CorrespondenceFirmware>}
   */
  ({ firmwaresConfig, createTempFile, firmwareImageParser }) => {
    const { dir } = firmwaresConfig();
    const uploadDir = path.join(dir, origin);
    const stream = cloneable(fileStream); // make cloneable early to prevent stream close
    let cleanupCallback = null;

    return createTempFile()
      .then(({ writeStream: tempFileStream, cleanup, filePath }) => new Promise((resolve, reject) => {
        cleanupCallback = cleanup;
        let result = null;
        let callCounter = isNotNull(md5) ? 3 : 2;

        const resolver = (firmwareFilename) => { result = { filePath, firmwareFilename } };

        const finalizer = (err) => {
          callCounter -= 1;
          if (isNotNil(err)) {
            reject(err);
          } else if (callCounter === 0) {
            if (result === null || result.firmwareFilename === null) {
              reject(new UnknownFirmwareImage());
            } else {
              resolve(result);
            }
          }
        };

        // check md5 hash
        if (isNotNull(md5)) {
          const hashStream = crypto.createHash('md5');
          hashStream.setEncoding('hex');

          const hashStreamFinalizer = (err) => {
            if (err === null && hashStream.read() !== md5) {
              return finalizer(new MismatchMD5FirmwareImage());
            }
            return finalizer(err);
          };

          pump(stream.clone(), hashStream, hashStreamFinalizer);
        }
        // save to temp file
        pump(stream.clone(), tempFileStream, finalizer);

        // detect firmware type and version
        pump(stream, firmwareImageParser(resolver), finalizer);
      }))
      .then(({ filePath: tmpFilePath, firmwareFilename }) => {
        const filePath = path.join(uploadDir, firmwareFilename);
        return fse.move(tmpFilePath, filePath, { overwrite: true })
          .then(() => getFileSize(filePath))
          .then(size => fromFile({ origin, size, filename: firmwareFilename }))
          .then(chain(firmware => (firmware === null
            ? Either.Left(new UnknownFirmwareImage())
            : Either.Right(firmware))))
          .then(cata(rejectP, resolveP));
      })
      .catch((error) => {
        if (isFunction(cleanupCallback)) { cleanupCallback() }
        return handleError(error);
      });
  }
);

module.exports = {
  load,
  save,
  remove,
  removeAll,
};
