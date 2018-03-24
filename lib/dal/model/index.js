'use strict';

const { keyBy, get } = require('lodash/fp');

const logModelFactory = require('./log');
const logAggModelFactory = require('./logAgg');
const outageModelFactory = require('./outage');
const outageAggModelFactory = require('./outageAgg');
const discoveryDeviceFactory = require('./discoveryDevice');
const discoveryResultFactory = require('./discoveryResult');
const taskFactory = require('./task');
const taskBatchFactory = require('./taskBatch');
const taskBatchAggFactory = require('./taskBatchAgg');
const macAesKeyFactory = require('./macAesKey');
const deviceMetadataFactory = require('./deviceMetadata');
const dataLinkFactory = require('./dataLink');
const userFactory = require('./user');
const userProfileFactory = require('./userProfile');
const mobileDeviceFactory = require('./mobileDevice');

module.exports = (sequelize, DataTypes) => keyBy(get('name'), [
  logModelFactory(sequelize, DataTypes),
  logAggModelFactory(sequelize, DataTypes),
  outageModelFactory(sequelize, DataTypes),
  outageAggModelFactory(sequelize, DataTypes),
  discoveryDeviceFactory(sequelize, DataTypes),
  discoveryResultFactory(sequelize, DataTypes),
  taskFactory(sequelize, DataTypes),
  taskBatchFactory(sequelize, DataTypes),
  taskBatchAggFactory(sequelize, DataTypes),
  macAesKeyFactory(sequelize, DataTypes),
  deviceMetadataFactory(sequelize, DataTypes),
  dataLinkFactory(sequelize, DataTypes),
  userFactory(sequelize, DataTypes),
  userProfileFactory(sequelize, DataTypes),
  mobileDeviceFactory(sequelize, DataTypes),
]);

