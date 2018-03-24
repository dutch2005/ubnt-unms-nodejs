'use strict';

const { values } = require('lodash/fp');

const { DiscoveryMethodEnum, ProgressStatusEnum } = require('../../enums');
const { functorTrait } = require('../utils');

/**
 * Discovery result
 *
 * @typedef {Object} DbDiscoveryResult
 * @property {string} id UUID
 * @property {string} userId UUID
 * @property {DiscoveryMethodEnum} method
 * @property {?string} ipRangeInput
 * @property {?Array.<IpRange>} ipRangeParsed
 * @property {?Array.<string>} ipList
 * @property {ProgressStatusEnum} status
 * @property {?string} error
 * @property {Date} timestamp
 */

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const discoveryResultModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
    },
    method: {
      type: DataTypes.ENUM,
      values: values(DiscoveryMethodEnum),
    },
    ipRangeInput: {
      type: DataTypes.STRING,
      field: 'ip_range_input',
    },
    ipRangeParsed: {
      type: DataTypes.JSONB,
      field: 'ip_range_parsed',
    },
    ipList: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      field: 'ip_list',
    },
    status: {
      type: DataTypes.ENUM,
      values: values(ProgressStatusEnum),
    },
    error: {
      type: DataTypes.STRING,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.discoveryResultModel)),
  };

  return sequelize.define('discoveryResultModel', discoveryResultModel, config);
};
/* eslint-enable new cap */
