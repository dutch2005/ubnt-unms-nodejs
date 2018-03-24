'use strict';

const { functorTrait } = require('../utils');

/* eslint-disable new-cap */
module.exports = (sequelize, DataTypes) => {
  const outageAggModel = {
    type: DataTypes.STRING,
    count: DataTypes.INTEGER,
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.outageAggModel)),
  };

  return sequelize.define('outageAggModel', outageAggModel, config);
};
/* eslint-enable new cap */
