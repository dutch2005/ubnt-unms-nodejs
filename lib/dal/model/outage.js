'use strict';

const { values } = require('lodash/fp');

const { OutageTypeEnum } = require('../../enums');
const { functorTrait } = require('../utils');

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const outageModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    startTimestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'start_timestamp',
    },
    endTimestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'end_timestamp',
    },
    site: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    device: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    type: {
      type: DataTypes.ENUM,
      values: values(OutageTypeEnum),
      defaultValue: OutageTypeEnum.Outage,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.outageModel)),
  };

  return sequelize.define('outageModel', outageModel, config);
};
/* eslint-enable new cap */
