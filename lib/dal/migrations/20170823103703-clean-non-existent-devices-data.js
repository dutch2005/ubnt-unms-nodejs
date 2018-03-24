'use strict';

const { get, map, spread, difference, join, filter, size, flow } = require('lodash/fp');
const bluebird = require('bluebird');
const { readdirAsync, emptyDirAsync, rmdirAsync } = bluebird.promisifyAll(require('fs-extra'));
const joi = require('joi');
const { when, lt } = require('ramda');

const { DB } = require('../../db');
const { resolveP, allP, tapP } = require('../../util');


const BACKUPS_DIR = './data/config-backups';
const isDeviceId = dir => joi.validate(dir, joi.string().guid()).error === null;

const deleteDeviceConfigBackups = () => {
  const deviceIdsPromise = DB.device.list().then(map(get(['id'])));
  const configBackupDirListPromise = readdirAsync(BACKUPS_DIR).then(filter(isDeviceId));

  return allP([configBackupDirListPromise, deviceIdsPromise])
    .then(spread(difference))
    .then(tapP(dirs => allP(map(DB.device.removeAllBackups, dirs))))
    .then(tapP(dirs => allP(map(dir => emptyDirAsync(`${BACKUPS_DIR}/${dir}`), dirs))))
    .then(dirs => allP(map(dir => rmdirAsync(`${BACKUPS_DIR}/${dir}`), dirs)));
};

const deleteDeviceLogs = queryInterface => DB.device.list()
  .then(when(
    flow(size, lt(0)),
    deviceList => resolveP(deviceList)
      .then(map(get(['id'])))
      .then(map(id => `'${id}'`))
      .then(join(','))
      .then(idsString => queryInterface.sequelize.query(
        `DELETE FROM log WHERE device <> '{}' AND device->>'id' NOT IN (${idsString})`
      ))
  ));

const deleteDeviceOutages = queryInterface => DB.device.list()
  .then(when(
    flow(size, lt(0)),
    deviceList => resolveP(deviceList)
      .then(map(get(['id'])))
      .then(map(id => `'${id}'`))
      .then(join(','))
      .then(idsString => queryInterface.sequelize.query(
        `DELETE FROM outage WHERE device <> '{}' AND device->>'id' NOT IN (${idsString})`
      ))
  ));

module.exports = {
  up(queryInterface) {
    return allP([
      deleteDeviceConfigBackups(),
      deleteDeviceLogs(queryInterface),
      deleteDeviceOutages(queryInterface),
    ]);
  },
  down() {
    return resolveP();
  },
};
