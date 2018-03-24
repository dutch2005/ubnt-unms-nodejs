'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query(
      "CREATE TYPE logTypeEnum AS ENUM ('other', 'device-appear', 'device-disappear', 'device-reappear'," +
      " 'device-ram-over-limit', 'device-cpu-over-limit', 'device-authorize', 'device-move', 'device-backup-create', " +
      " 'device-backup-apply', 'device-restart', 'device-delete', 'device-automatic-backup-create', 'device-outage', " +
      " 'user-login');"
    ).then(() => queryInterface.sequelize.query(
      "ALTER TABLE log ADD COLUMN type logTypeEnum NOT NULL DEFAULT 'other';"
    )).then(() => queryInterface.sequelize.query(
      'CREATE INDEX ON log(type);'
    ));
  },

  down(queryInterface) {
    return queryInterface.sequelize.query('ALTER TABLE log DROP COLUMN type;')
      .then(() => queryInterface.sequelize.query('DROP TYPE logTypeEnum;'));
  },
};
