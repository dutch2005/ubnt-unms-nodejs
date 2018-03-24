'use strict';

const { values } = require('lodash/fp');

const { MobileDevicePlatformEnum } = require('../../enums');
const { functorTrait } = require('../utils');

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const mobileDeviceModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
    },
    name: {
      type: DataTypes.CHAR,
    },
    platform: {
      type: DataTypes.ENUM,
      values: values(MobileDevicePlatformEnum),
    },
    token: {
      type: DataTypes.TEXT,
    },
    device_key: {
      type: DataTypes.TEXT,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.mobileDeviceModel)),
    tableName: 'mobile_device',
  };

  return sequelize.define('mobileDeviceModel', mobileDeviceModel, config);
};
/* eslint-enable new cap */
