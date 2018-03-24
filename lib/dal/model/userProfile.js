'use strict';

const { functorTrait } = require('../utils');

module.exports = (sequelize, DataTypes) => {
  const userProfileModel = {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'user_id',
    },
    alerts: {
      type: DataTypes.BOOLEAN,
    },
    presentationMode: {
      type: DataTypes.BOOLEAN,
      field: 'presentation_mode',
    },
    forceChangePassword: {
      type: DataTypes.BOOLEAN,
      field: 'force_password_change',
    },
    lastLogItemId: {
      type: DataTypes.UUID,
      field: 'last_log_item_id',
    },
    tableConfig: {
      type: DataTypes.JSONB,
      field: 'table_config',
    },
    lastNewsSeenDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'last_news_seen_date',
    },
  };

  const config = {
    instanceMethods: Object.assign({}, functorTrait(() => sequelize.models.userProfileModel)),
  };

  return sequelize.define('userProfileModel', userProfileModel, config);
};
