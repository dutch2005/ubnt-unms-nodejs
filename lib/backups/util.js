'use strict';

const crc32 = require('crc-32');
const { curry, partial, keyBy, keys, flow, negate } = require('lodash');
const {
  constant, union, filter, forEach, map, __, includes, get, startsWith, invokeArgs, partialRight, curryN,
} = require('lodash/fp');
const moment = require('moment-timezone');
const { slice, split, join, reject, pathEq } = require('ramda');
const bluebird = require('bluebird');
const { writeFileAsync, readdirAsync, unlinkAsync, ensureDirAsync } = bluebird.promisifyAll(require('fs-extra'));
const zlib = require('zlib');

const config = require('../../config');
const { DB } = require('../db');
const { tapP, readFile } = require('../util');
const { log } = require('../logging');
const { DeviceTypeEnum } = require('../enums');


/*
 * Device backups
 */

const getBackupDirName = id => `${config.deviceConfigBackup.dir}/${id}`;

const getBackupFilePath = (deviceId, backupId) => `${getBackupDirName(deviceId)}/${backupId}.tar.gz`;

const filterDeviceBackups = (historyLimit, backups) => filter(b => b.timestamp > historyLimit, backups);

const removeBackupFiles = curry((deviceId, backups) => {
  const dirName = getBackupDirName(deviceId);
  const backupsToKeep = keyBy(backups, 'id');
  const backupIdsToKeep = keys(backupsToKeep);
  const removeFileExtension = file => file.replace('.tar.gz', '');
  const getFileAbsPath = fileName => `${dirName}/${fileName}`;
  const backupIdsToSaveSelector = flow(removeFileExtension, includes(__, backupIdsToKeep));
  const obsoleteBackupIdsSelector = negate(backupIdsToSaveSelector);
  const readdirAsyncPromise = readdirAsync(dirName);
  const backupsToSaveSelector = fileIdsToKeep => filter(flow(get('id'), includes(__, fileIdsToKeep)))(backups);

  return readdirAsyncPromise
    .then(filter(obsoleteBackupIdsSelector))
    .then(map(getFileAbsPath))
    .then(forEach(unlinkAsync))
    .then(constant(readdirAsyncPromise))
    .then(filter(backupIdsToSaveSelector))
    .then(map(removeFileExtension))
    .then(backupsToSaveSelector);
});


const removeOldDeviceBackupFiles = curry((deviceId, backups) => {
  Promise.resolve(backups)
    .then((backupList) => {
      if (backupList.length < config.deviceConfigBackup.minimumFiles) {
        return backupList;
      }
      const historyLimit = moment().subtract(config.deviceConfigBackup.ttl, 'ms').valueOf();
      const sortBackups = (a, b) => ((a.timestamp > b.timestamp) ? -1 : 1);
      const backupsToKeep = slice(
        0, config.deviceConfigBackup.minimumFiles, backupList.slice().sort(sortBackups)
      );
      return union(backupsToKeep, filterDeviceBackups(historyLimit, backupList));
    })
    .then(tapP(partial(DB.device.removeAllBackups, deviceId)))
    .then(removeBackupFiles(deviceId))
    .then(forEach(DB.device.insertBackup(deviceId)));
});

// writeDeviceBackupFile :: String -> String -> Object -> Object
const writeDeviceBackupFile = curry((dirName, id, { source, crc }) => {
  const filePath = `${dirName}/${id}.tar.gz`;
  const timestamp = Number(moment().utc().format('x'));

  return ensureDirAsync(dirName)
    .then(() => writeFileAsync(filePath, Buffer.from(source, 'hex')))
    .then(() => ({ id, timestamp, crc }));
});


const deleteBackupFile = (deviceId, backupId) => {
  const fileName = getBackupFilePath(deviceId, backupId);
  return unlinkAsync(fileName)
    .catch((error) => {
      log('error', { error, message: `Failed to remove backup config file: ${fileName}.` });
      throw error;
    });
};

const getBackupFile = curryN(2, flow(getBackupFilePath, readFile));

// in gzipped archive crc32 checksum is the reverse ordered 4-byte sequence, placed right before the last 4 bytes
const parseCrc32FromGzippedBackup = (source) => {
  const crc = Buffer.alloc(4);
  const src = Buffer.from(source, 'hex');
  src.copy(crc, 0, src.byteLength - 8, src.byteLength - 4);
  return crc.reverse().toString('hex');
};

const computeCrc32FromAirMaxBackup = source => flow(
  src => Buffer.from(src, 'hex').toString(),
  split('\n'),
  reject(startsWith('#')),
  join('\n'),
  crc32.str
)(source);

const isDeviceAirMax = pathEq(['identification', 'type'], DeviceTypeEnum.AirMax);
const toHexString = invokeArgs('toString', ['hex']);
const fromHexString = partialRight(Buffer.from, ['hex']);
const zipAirMaxBackup = flow(fromHexString, zlib.gzipSync, toHexString);
const unzipAirMaxBackup = zlib.unzipSync;

const getAirMaxBackupWithCrc = source => ({
  crc: computeCrc32FromAirMaxBackup(source),
  source: zipAirMaxBackup(source),
});

const getBackupWithCrc = source => ({
  crc: parseCrc32FromGzippedBackup(source),
  source,
});


module.exports = {
  writeDeviceBackupFile,
  removeOldDeviceBackupFiles,
  deleteBackupFile,
  getBackupFile,
  getBackupDirName,
  getBackupFilePath,
  parseCrc32FromGzippedBackup,
  computeCrc32FromAirMaxBackup,
  zipAirMaxBackup,
  unzipAirMaxBackup,
  getAirMaxBackupWithCrc,
  getBackupWithCrc,
  isDeviceAirMax,
  fromHexString,
};
