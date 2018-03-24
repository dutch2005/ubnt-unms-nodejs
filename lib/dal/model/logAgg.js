'use strict';

const { functorTrait } = require('../utils');

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const logAggModel = {
    level: DataTypes.STRING,
    count: DataTypes.INTEGER,
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.logAggModel)),
  };

  return sequelize.define('logAggModel', logAggModel, config);
};
/* eslint-enable new cap */
