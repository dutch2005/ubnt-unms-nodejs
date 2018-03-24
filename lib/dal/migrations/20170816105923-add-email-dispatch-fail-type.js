'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query("ALTER TYPE logTypeEnum ADD VALUE 'email-dispatch-fail';");
  },

  down(queryInterface) {
    return queryInterface.sequelize.query("DELETE FROM pg_enum WHERE enumlabel = 'email-dispatch-fail' " +
      " AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'logtypeenum');"); // logtypeenum lowercased
  },
};
