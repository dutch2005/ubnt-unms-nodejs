'use strict';

// WARNING !
// DO NOT require anything that could require DAL before dal.initialize() is called.

// postgresql and Javascript treat numbers differently.
// This settings tells pg driver to cast BIGINT postgresql type
// into Javascript Number type. This may cause unexpected side effects
// on very big numbers.
require('pg').defaults.parseInt8 = true;

process.env.BLUEBIRD_LONG_STACK_TRACES = 0;
process.env.BLUEBIRD_WARNINGS = 0;

const { Sequelize } = require('sequelize');

const logging = require('./lib/logging');

const application = require('./bootstrap');
const dal = require('./lib/dal');
const config = require('./config');
const enums = require('./lib/enums');
const goodConfig = require('./lib/reporting/config');
const model = require('./lib/model');

// bootstrap the demo application
if (config.demo) {
  application.bootstrap().run({ goodConfig, model, enums, config, logging })
    .catch((error) => {
      logging.error('Failed to bootstrap UNMS in demo mode', error);
      process.exit(1);
    });
} else {
  // setup database before application bootstrap.
  const options = {
    dialect: 'postgres',
    host: config.pg.host,
    port: config.pg.port,
    logging: false,
  };

  const sequelize = new Sequelize(config.pg.database, config.pg.user, config.pg.password, options);
  // bootstrap the production application when sequelize is ready.
  sequelize.import('./lib/dal/model');
  sequelize.authenticate()
    .then(() => dal.initialize(sequelize))
    .then(() => application.bootstrap().run({ goodConfig, sequelize, model, enums, config, logging }))
    .catch((error) => {
      logging.error('Failed to bootstrap UNMS', error);
      process.exit(1);
    });
}

