'use strict';

const bluebird = require('bluebird');
const moment = require('moment-timezone');
const {
  writeFile, readFile, ensureDir, stat, exists, unlink, createWriteStream,
} = bluebird.promisifyAll(require('fs-extra'));
const { set } = require('lodash');
const { isNull, curry, omit, has } = require('lodash/fp');
const semver = require('semver');
const { Reader: reader } = require('monet');

const model = require('../model');
const { toMs, resolveP } = require('../util');
const packageJson = require('../../package.json');
const { NmsUpdateStatusEnum } = require('../enums');

const getStatus = curry((daemonActiveLimit, now, nmsUpdateStatus, lastUpdateUTCTimestamp) => ({
  nmsUpdateStatus,
  canNmsUpdate: isNull(lastUpdateUTCTimestamp)
    ? false
    : moment(now).utc().subtract(daemonActiveLimit, 'ms').isBefore(lastUpdateUTCTimestamp),
}));

const decorateNmsWithUpdate = curry((from, to, nms) => Object.assign({}, nms, { updating: { from, to } }));

const deleteFileIfExists = path =>
  unlink(path)
    .catch((err) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });

function checkNmsUpdateTimeout(timeout, requestFile, logging, now = Date.now()) {
  if (moment(now).utc().subtract(timeout, 'ms').isAfter(model.nmsUpdate.lastActiveTimestamp)) {
    logging.error(`UNMS update timed out (last: ${model.nmsUpdate.lastActiveTimestamp}, now: ${now})`);
    model.nmsUpdate.status = NmsUpdateStatusEnum.Ready;
    logging.info(`UNMS update status changed to ${model.nmsUpdate.status}`);
    return deleteFileIfExists(requestFile);
  }
  return null;
}

const checkNmsUpdateProgress = () => reader(
  ({ config, logging }) => {
    if (model.nmsUpdate.status === NmsUpdateStatusEnum.Ready) return resolveP(true);
    const { requestFile, logFile, timeouts } = config.nmsUpdate;

    return exists(requestFile)
      .then(updateRequestFileExists => (
        updateRequestFileExists
          ? NmsUpdateStatusEnum.Requested
          : stat(logFile)
              .then((stats) => {
                model.nmsUpdate.lastActiveTimestamp = stats.mtime;
                return NmsUpdateStatusEnum.Updating;
              })
              .catch(() => NmsUpdateStatusEnum.Started)
      ))
      .then((nmsUpdateStatus) => {
        if (model.nmsUpdate.status !== nmsUpdateStatus) {
          model.nmsUpdate.lastActiveTimestamp = Date.now();
          model.nmsUpdate.status = nmsUpdateStatus;
          logging.info(`UNMS update status changed to ${model.nmsUpdate.status}`);
          return null;
        }

        return checkNmsUpdateTimeout(timeouts[nmsUpdateStatus], requestFile, logging);
      });
  }
);

const backupBeforeUpdate = (backups, backupFile, logging) =>
  resolveP(logging.info('Backing up UNMS before update'))
    .then(() => backups.backupToFile({ firmwares: false }))
    .then(readStream => new Promise((resolve, reject) => {
      logging.info(`Writing backup to archive ${backupFile}`);
      const writeStream = createWriteStream(backupFile);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      readStream.pipe(writeStream);
    }))
    .then(() => logging.info('UNMS backup before update finished successfully'))
    .catch((err) => {
      logging.error('Failed to write backup to archive', err);
      throw err;
    });

const requestNmsUpdate = targetVersion => reader(
  ({ config, backups, DB, logging, eventLog }) => {
    if (model.nmsUpdate.status !== NmsUpdateStatusEnum.Ready) return null;
    const { backupFile, logFile, dir, requestFile } = config.nmsUpdate;
    return resolveP()
      .then(() => backupBeforeUpdate(backups, backupFile, logging))
      .then(() => deleteFileIfExists(logFile))
      .then(() => eventLog.logNmsUpdateStarted(packageJson.version, targetVersion))
      .then(DB.nms.get)
      .then(decorateNmsWithUpdate(packageJson.version, targetVersion))
      .then(DB.nms.update)
      .then(() => ensureDir(dir))
      .then(() => set(model.nmsUpdate, 'status', NmsUpdateStatusEnum.Requested))
      .then(() => logging.info(`UNMS update status changed to ${model.nmsUpdate.status}`))
      .then(() => set(model.nmsUpdate, 'lastActiveTimestamp', Date.now()))
      .then(() => writeFile(requestFile, targetVersion))
      .then(() => logging.info(`Created update request file ${requestFile}`));
  }
);

const getNmsUpdateStatus = (now = Date.now()) => reader(
  ({ config, logging }) => {
    const { lastUpdateFile, daemonActiveLimit } = config.nmsUpdate;
    return readFile(lastUpdateFile)
      .then(Number)
      .then(toMs('second'))
      .then(getStatus(daemonActiveLimit, now, model.nmsUpdate.status))
      .catch((err) => {
        if (err.code !== 'ENOENT') {
          logging.error(`Failed to read last update file ${config.nmsUpdate.lastUpdateFile}`, err);
        }
        return getStatus(daemonActiveLimit, now, model.nmsUpdate.status, null);
      });
  }
);

const checkNmsUpdateResult = () => reader(
  ({ DB, eventLog }) => DB.nms.get()
    .then((nms) => {
      if (!has('updating', nms)) {
        return null;
      }

      const { logNmsUpdateSuccessful, logNmsUpdateFailed, logNmsUpdateUnknown } = eventLog;

      // compare version numbers but ignore prerelease tags
      let logResult;
      try {
        const versionDiff = semver.diff(packageJson.version, nms.updating.to);
        const isSameVersion = versionDiff === null || versionDiff === 'prerelease';
        logResult = isSameVersion ? logNmsUpdateSuccessful : logNmsUpdateFailed;
      } catch (err) {
        logResult = logNmsUpdateUnknown;
      }

      return Promise.resolve()
        .then(() => logResult(nms.updating.from, nms.updating.to, packageJson.version))
        .then(() => omit('updating', nms))
        .then(DB.nms.update);
    })
);

module.exports = {
  requestNmsUpdate,
  getNmsUpdateStatus,
  checkNmsUpdateResult,
  checkNmsUpdateProgress,
};
