'use strict';

const { functorTrait } = require('../utils');

/**
 * Device metadata
 *
 * @typedef {Object} DbDeviceMetadata
 * @property {string} id UUID of device
 * @property {boolean} failedMessageDecryption with saved AES key on during websocket communication
 * @property {Date} restartTimestamp
 * @property {?string} alias for the name of the device
 * @property {?string} note
 */

module.exports = (sequelize, DataTypes) => {
  const deviceMetadataModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    failedMessageDecryption: {
      type: DataTypes.BOOLEAN,
      field: 'failed_message_decryption',
      allowNull: false,
      defaultValue: false,
    },
    restartTimestamp: {
      type: DataTypes.DATE,
      defaultValue: null,
      field: 'restart_timestamp',
    },
    alias: {
      type: DataTypes.STRING(30),
      field: 'alias',
      defaultValue: {},
    },
    note: {
      type: DataTypes.TEXT,
      field: 'text',
      defaultValue: null,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.deviceMetadataModel)),
    tableName: 'device_metadata',
  };

  return sequelize.define('deviceMetadataModel', deviceMetadataModel, config);
};
