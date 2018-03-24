'use strict';

const { values } = require('lodash/fp');

const { LogLevelEnum, LogTypeEnum } = require('../../enums');
const { functorTrait } = require('../utils');

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const logModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    message: {
      type: DataTypes.TEXT,
      defaultValue: 'default log message',
    },
    level: {
      type: DataTypes.ENUM,
      values: values(LogLevelEnum),
      defaultValue: LogLevelEnum.Info,
    },
    type: {
      type: DataTypes.ENUM,
      values: values(LogTypeEnum),
      defaultValue: LogTypeEnum.Other,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    site: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    device: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    mailNotificationEmails: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'mail_notification_emails',
    },
    mailNotificationTimestamp: {
      type: DataTypes.DATE,
      defaultValue: null,
      field: 'mail_notification_timestamp',
    },
    remoteAddress: {
      type: DataTypes.TEXT,
      field: 'remote_address',
      defaultValue: null,
    },
    user: {
      type: DataTypes.STRING,
      defaultValue: {},
    },
    token: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.logModel)),
    tableName: 'log',
  };

  return sequelize.define('logModel', logModel, config);
};
/* eslint-enable new cap */
