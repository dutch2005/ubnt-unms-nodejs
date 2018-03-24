'use strict';

const { values } = require('lodash/fp');

const { functorTrait } = require('../utils');
const { MacAesKeyExchangeStatusEnum } = require('../../enums');

/**
 * AES keys mapped by MAC addresses of devices(eth0)
 *
 * @typedef {Object} DbMacAesKey
 * @property {string} id UUID of device
 * @property {string} mac MACADDR of device
 * @property {string} key CHAR(44)
 * @property {Date} lastSeen TIMESTAMPTZ
 * @property {string} ip VARCHAR
 * @property {string} model VARCHAR
 * @property {MacAesKeyExchangeStatusEnum} exchangeStatus
 */

module.exports = (sequelize, DataTypes) => {
  const macAesKeyModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    mac: {
      type: 'macaddr',
      allowNull: false,
    },
    key: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
    exchangeStatus: {
      type: DataTypes.ENUM,
      values: values(MacAesKeyExchangeStatusEnum),
      field: 'exchange_status',
      allowNull: false,
      defaultValue: MacAesKeyExchangeStatusEnum.Pending,
    },
    lastSeen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'last_seen',
    },
    ip: {
      type: DataTypes.STRING,
    },
    model: {
      type: DataTypes.STRING,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.macAesKeyModel)),
    tableName: 'mac_aes_key',
  };

  return sequelize.define('macAesKeyModel', macAesKeyModel, config);
};
