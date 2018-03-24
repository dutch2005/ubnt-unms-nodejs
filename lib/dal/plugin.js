'use strict';

const { registerPlugin } = require('../util/hapi');
const logRepository = require('./repositories/log');
const outageRepository = require('./repositories/outage');
const discoveryDeviceRepository = require('./repositories/discoveryDevice');
const discoveryResultRepository = require('./repositories/discoveryResult');
const taskRepository = require('./repositories/task');
const taskBatchRepository = require('./repositories/taskBatch');
const macAesKeyRepository = require('./repositories/macAesKey');
const deviceMetadataRepository = require('./repositories/deviceMetadata');
const dataLinkRepository = require('./repositories/dataLink');

const deviceMetadataHandlers = require('./repositories/deviceMetadata/handlers');

const mobileDeviceRepository = require('./repositories/mobileDevice');
const userRepository = require('./repositories/user');
const userProfileRepository = require('./repositories/userProfile');
const { bindRepository } = require('./utils');

function register(server) {
  const { messageHub } = server.plugins;
  const { sequelize } = server.plugins.sequelize;
  const logRepositoryBound = bindRepository(sequelize, logRepository);
  const outageRepositoryBound = bindRepository(sequelize, outageRepository);
  const discoveryDeviceRepositoryBound = bindRepository(sequelize, discoveryDeviceRepository);
  const discoveryResultRepositoryBound = bindRepository(sequelize, discoveryResultRepository);
  const taskRepositoryBound = bindRepository(sequelize, taskRepository);
  const taskBatchRepositoryBound = bindRepository(sequelize, taskBatchRepository);
  const macAesKeyRepositoryBound = bindRepository(sequelize, macAesKeyRepository);
  const deviceMetadataRepositoryBound = bindRepository(sequelize, deviceMetadataRepository);
  const dataLinkRepositoryBound = bindRepository(sequelize, dataLinkRepository);
  const mobileDeviceRepositoryBound = bindRepository(sequelize, mobileDeviceRepository);
  const userRepositoryBound = bindRepository(sequelize, userRepository);
  const userProfileRepositoryBound = bindRepository(sequelize, userProfileRepository);

  /**
   * @name DbDal
   * @type {{
   *   logRepository: *,
   *   outageRepository: *,
   *   discoveryDeviceRepository: DbDiscoveryDeviceRepository,
   *   discoveryResultRepository: *,
   *   taskRepository: DbTaskRepository,
   *   taskBatchRepository: DbTaskBatchRepository,
   *   macAesKeyRepository: DbMacAesKeyRepository,
   *   deviceMetadataRepository: DbDeviceMetadataRepository,
   *   dataLinkRepository: DbDataLinkRepository,
   * }}
   */
  const dal = {
    logRepository: logRepositoryBound,
    outageRepository: outageRepositoryBound,
    discoveryDeviceRepository: discoveryDeviceRepositoryBound,
    discoveryResultRepository: discoveryResultRepositoryBound,
    taskRepository: taskRepositoryBound,
    taskBatchRepository: taskBatchRepositoryBound,
    macAesKeyRepository: macAesKeyRepositoryBound,
    deviceMetadataRepository: deviceMetadataRepositoryBound,
    dataLinkRepository: dataLinkRepositoryBound,
    mobileDeviceRepository: mobileDeviceRepositoryBound,
    userRepository: userRepositoryBound,
    userProfileRepository: userProfileRepositoryBound,
  };

  server.expose(dal);
  server.expose(sequelize.models);

  messageHub.registerHandlers(deviceMetadataHandlers);

  server.decorate('request', 'dal', Object.assign(dal, sequelize.models));
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'dal',
  version: '1.0.0',
  dependencies: ['sequelize', 'messageHub'],
};

