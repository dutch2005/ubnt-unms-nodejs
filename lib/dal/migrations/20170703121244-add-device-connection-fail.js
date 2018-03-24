'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query("ALTER TYPE logTypeEnum ADD VALUE 'device-connection-fail';");
  },

  down(queryInterface) {
    return queryInterface.sequelize.query("DELETE FROM log WHERE type = 'device-connection-fail' ")
      .then(() => queryInterface.sequelize.query("DELETE FROM pg_enum WHERE enumlabel = 'device-connection-fail' " +
        " AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'logtypeenum');"));
  },
};
