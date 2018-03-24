'use strict';

const { values } = require('lodash/fp');

const { functorTrait } = require('../utils');
const { DataLinkOriginEnum } = require('../../enums');

/**
 * Data link(connection) between two nodes(devices)
 *
 * @typedef {Object} DbDataLink
 * @property {string} id UUID of Data Link
 * @property {string} deviceIdFrom UUID
 * @property {string} interfaceNameFrom STRING(50)
 * @property {string} deviceIdTo UUID
 * @property {string} interfaceNameTo STRING(50)
 * @property {DataLinkOriginEnum} origin
 */

module.exports = (sequelize, DataTypes) => {
  const dataLinkModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    deviceIdFrom: {
      type: DataTypes.UUID,
      field: 'device_id_from',
      allowNull: false,
    },
    interfaceNameFrom: {
      type: DataTypes.STRING(50),
      field: 'interface_name_from',
      allowNull: false,
    },
    deviceIdTo: {
      type: DataTypes.UUID,
      field: 'device_id_to',
      allowNull: false,
    },
    interfaceNameTo: {
      type: DataTypes.STRING(50),
      field: 'interface_name_to',
      allowNull: false,
    },
    origin: {
      type: DataTypes.ENUM,
      values: values(DataLinkOriginEnum),
      allowNull: false,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.dataLinkModel)),
    tableName: 'data_link',
  };

  return sequelize.define('dataLinkModel', dataLinkModel, config);
};
