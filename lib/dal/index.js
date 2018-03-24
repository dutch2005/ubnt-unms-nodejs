'use strict';

const { Sequelize } = require('sequelize');

const logRepository = require('./repositories/log');
const outageRepository = require('./repositories/outage');
const discoveryResultRepository = require('./repositories/discoveryResult');
const discoveryDeviceRepository = require('./repositories/discoveryDevice');
const taskRepository = require('./repositories/task');
const taskBatchRepository = require('./repositories/taskBatch');
const macAesKeyRepository = require('./repositories/macAesKey');
const deviceMetadataRepository = require('./repositories/deviceMetadata');
const dataLinkRepository = require('./repositories/dataLink');
const mobileDeviceRepository = require('./repositories/mobileDevice');
const userRepository = require('./repositories/user');
const userProfileRepository = require('./repositories/userProfile');
const { bindRepository } = require('./utils');

// warning: this module uses the shared state to circumvent the use-case of needing the sequelize
// instance reference outside of the scope of request and server. If you hit this use-case
// you are probably building the hapi.js architecture incorrectly.
//
// If this module exports isInitialize === true, you can be sure that sequelize is initialized and
// successfully connected to your relational database.

function initializeModels(sequelize) {
  return sequelize.models;
}

function initializeRepositories(sequelize) {
  return {
    logRepository: bindRepository(sequelize, logRepository),
    outageRepository: bindRepository(sequelize, outageRepository),
    discoveryResultRepository: bindRepository(sequelize, discoveryResultRepository),
    discoveryDeviceRepository: bindRepository(sequelize, discoveryDeviceRepository),
    taskRepository: bindRepository(sequelize, taskRepository),
    taskBatchRepository: bindRepository(sequelize, taskBatchRepository),
    macAesKeyRepository: bindRepository(sequelize, macAesKeyRepository),
    deviceMetadataRepository: bindRepository(sequelize, deviceMetadataRepository),
    dataLinkRepository: bindRepository(sequelize, dataLinkRepository),
    mobileDeviceRepository: bindRepository(sequelize, mobileDeviceRepository),
    userRepository: bindRepository(sequelize, userRepository),
    userProfileRepository: bindRepository(sequelize, userProfileRepository),
  };
}

const internals = {
  isInitialized: false,
  Sequelize,
  sequelize: null,
  initialize(sequelize) {
    this.sequelize = sequelize;
    Object.assign(this, initializeModels(sequelize));
    Object.assign(this, initializeRepositories(sequelize));
    this.isInitialized = true;
  },
};

module.exports = internals;
