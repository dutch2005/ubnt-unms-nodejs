'use strict';

const fs = require('fs');
const aguid = require('aguid');

const { LogLevelEnum, LogTypeEnum } = require('../../enums');
const config = require('../../../config');
const logRepository = require('../../dal/repositories/log');
const outageRepository = require('../../dal/repositories/outage');

const logsImportFile = `${config.import.dir}/logs.json`;
const outagesImportFile = `${config.import.dir}/outages.json`;

function importLogs(sequelize) {
  if (!fs.existsSync(logsImportFile)) {
    console.log(`Logs import file ${logsImportFile} not found, won't import logs.`);
    return Promise.resolve();
  }
  console.log(`Importing logs from ${logsImportFile}.`);

  const oldData = JSON.parse(fs.readFileSync(logsImportFile, 'utf8'));

  const newData = oldData.map(entry => sequelize.models.logModel.build(
    Object.assign({}, entry, {
      site: entry.site ? JSON.stringify(entry.site) : undefined,
      device: entry.device ? JSON.stringify(entry.device) : undefined,
    })
  ));

  return Promise.all(newData.map(log => logRepository.save(log).run(sequelize)));
}

function importOutages(sequelize) {
  if (!fs.existsSync(outagesImportFile)) {
    console.log(`Outages import file ${outagesImportFile} not found, won't import outages.`);
    return Promise.resolve();
  }
  console.log(`Importing outages from ${outagesImportFile}.`);

  const oldData = JSON.parse(fs.readFileSync(outagesImportFile, 'utf8'));

  const newData = oldData.map(entry => sequelize.models.outageModel.build(
    Object.assign({}, entry, {
      site: entry.site ? JSON.stringify(entry.site) : undefined,
      device: entry.device ? JSON.stringify(entry.device) : undefined,
    })
  ));

  return Promise.all(newData.map(outage => outageRepository.save(outage).run(sequelize)));
}

module.exports = {
  up({ sequelize }) {
    sequelize.import('../../dal/model');
    return importLogs(sequelize)
      .then(() => importOutages(sequelize))
      .then(() => {
        if (fs.existsSync(logsImportFile)) fs.unlinkSync(logsImportFile);
        if (fs.existsSync(outagesImportFile)) fs.unlinkSync(outagesImportFile);
      })
      .catch((err) => {
        console.error('ERROR! Failed to import data from mongo', err);
        const log = sequelize.models.logModel.build({
          id: aguid(),
          message: 'Failed to migrate device history from previous version of UNMS',
          level: LogLevelEnum.Error,
          type: LogTypeEnum.Other,
          timestamp: new Date(),
          tags: ['import'],
        });
        logRepository.save(log).run(sequelize);
      });
  },

  down() {

  },
};
