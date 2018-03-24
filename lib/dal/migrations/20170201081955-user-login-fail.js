'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query("ALTER TYPE logTypeEnum ADD VALUE 'user-login-fail';");
  },

  down(queryInterface) {
    return queryInterface.sequelize.query("DELETE FROM pg_enum WHERE enumlabel = 'user-login-fail' " +
      " AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'logtypeenum');"); // logtypeenum lowercased
  },
};
