'use strict';

const { functorTrait } = require('../utils');

/**
 * Task batch aggregated by status
 *
 * @typedef {Object} DbTaskBatchAgg
 * @property {ProgressStatusEnum} status
 * @property {number} count
 */

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const taskBatchAgg = {
    status: DataTypes.STRING,
    count: DataTypes.INTEGER,
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.taskBatchAgg)),
  };

  return sequelize.define('taskBatchAgg', taskBatchAgg, config);
};
/* eslint-enable new cap */
