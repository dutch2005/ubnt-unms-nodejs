'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query("ALTER TYPE logTypeEnum ADD VALUE 'olt-got-unsupported-onu';");
  },

  down(queryInterface) {
    return queryInterface.sequelize.query("DELETE FROM pg_enum WHERE enumlabel = 'olt-got-unsupported-onu' " +
      " AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'logtypeenum');"); // logtypeenum lowercased
  },
};
