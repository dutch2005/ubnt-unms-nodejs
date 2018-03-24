'use strict';

const { values } = require('lodash/fp');

const {
  DiscoveryConnectStatusEnum, DiscoveryConnectProgressEnum, DeviceTypeEnum, DeviceCategoryEnum, ProgressStatusEnum,
} = require('../../enums');
const { functorTrait } = require('../utils');

/**
 * Discovered device
 *
 * @typedef {Object} DbDiscoveryDevice
 * @property {string} id UUID
 * @property {string} userId UUID
 * @property {string} resultId UUID
 * @property {string[]} possibleIds array of UUIDs
 * @property {Object} preferences connect preferences
 * @property {DiscoveryConnectStatusEnum} connectStatus
 * @property {?DiscoveryConnectProgressEnum} connectProgress
 * @property {?string} connectError
 * @property {string} firmwareVersion
 * @property {string} platformId
 * @property {DeviceModelEnum|string} model
 * @property {string} name
 * @property {string} mac
 * @property {string} ip
 * @property {DeviceTypeEnum} type
 * @property {DeviceCategoryEnum} category
 * @property {?ProgressStatusEnum} authenticationStatus
 * @property {?string} authenticationError
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const discoveryDeviceModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
    },
    resultId: {
      type: DataTypes.UUID,
      field: 'result_id',
    },
    possibleIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      field: 'possible_ids',
    },
    preferences: {
      type: DataTypes.JSONB,
      field: 'preferences',
    },
    connectStatus: {
      type: DataTypes.ENUM,
      values: values(DiscoveryConnectStatusEnum),
      field: 'connect_status',
    },
    connectProgress: {
      type: DataTypes.ENUM,
      values: values(DiscoveryConnectProgressEnum),
      field: 'connect_progress',
    },
    connectError: {
      type: DataTypes.STRING,
      field: 'connect_error',
    },
    platformId: {
      type: DataTypes.STRING,
      field: 'platform_id',
    },
    firmwareVersion: {
      type: DataTypes.STRING,
      field: 'firmware_version',
    },
    model: {
      type: DataTypes.STRING,
    },
    name: {
      type: DataTypes.STRING,
    },
    mac: {
      type: DataTypes.STRING,
    },
    ip: {
      type: DataTypes.STRING,
    },
    type: {
      type: DataTypes.ENUM,
      values: values(DeviceTypeEnum),
    },
    category: {
      type: DataTypes.ENUM,
      values: values(DeviceCategoryEnum),
    },
    authenticationStatus: {
      type: DataTypes.ENUM,
      values: values(ProgressStatusEnum),
      field: 'auth_status',
    },
    authenticationError: {
      type: DataTypes.STRING,
      field: 'auth_error',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
    uptime: {
      type: DataTypes.BIGINT,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.discoveryDeviceModel)),
  };

  return sequelize.define('discoveryDeviceModel', discoveryDeviceModel, config);
};
/* eslint-enable new cap */
