'use strict';

const { functorTrait } = require('../utils');

module.exports = (sequelize, DataTypes) => {
  const userModel = {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
    },
    totpAuthEnabled: {
      type: DataTypes.BOOLEAN,
      field: 'totp_auth_enabled',
    },
    totpAuthSecret: {
      type: DataTypes.STRING,
      field: 'totp_auth_secret',
    },
    role: {
      type: DataTypes.STRING,
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.userModel)),
  };

  return sequelize.define('userModel', userModel, config);
};
