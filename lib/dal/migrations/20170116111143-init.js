'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query(
      "CREATE TYPE logLevelEnum AS ENUM ('info', 'warning', 'error');"
    )
    .then(() => queryInterface.sequelize.query(
      'CREATE TABLE IF NOT EXISTS public.log( ' +
        'id uuid PRIMARY KEY NOT NULL, ' +
        "level logLevelEnum NOT NULL DEFAULT 'info', " +
        'timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), ' +
        'message TEXT NOT NULL, ' +
        "\"user\" JSONB NOT NULL default '{}', " +
        'token TEXT, ' +
        'remote_address VARCHAR, ' +
        "site JSONB NOT NULL default '{}', " +
        "device JSONB NOT NULL default '{}', " +
        'tags VARCHAR[] NOT NULL default ARRAY[]::VARCHAR[], ' +
        'mail_notification_emails VARCHAR[], ' +
        'mail_notification_timestamp TIMESTAMP WITH TIME ZONE);')
    )
    .then(() => queryInterface.sequelize.query("CREATE INDEX ON public.log((device->'id'));"))
    .then(() => queryInterface.sequelize.query("CREATE INDEX ON public.log((site->'id'));"))
    .then(() => queryInterface.sequelize.query(
      "CREATE TYPE outageTypeEnum AS ENUM ('outage', 'quality');"
    ))
    .then(() => queryInterface.sequelize.query(
      'CREATE TABLE IF NOT EXISTS public.outage( ' +
        'id uuid PRIMARY KEY NOT NULL, ' +
        'start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), ' +
        'end_timestamp TIMESTAMP WITH TIME ZONE, ' +
        "device JSONB NOT NULL default '{}', " +
        "site JSONB NOT NULL default '{}', " +
        "type outageTypeEnum NOT NULL DEFAULT 'outage');")
    )
    .then(() => queryInterface.sequelize.query("CREATE INDEX ON public.outage((device->'id'));"))
    .then(() => queryInterface.sequelize.query("CREATE INDEX ON public.outage((site->'id'));"));
  },

  down(queryInterface) {
    return queryInterface.sequelize.query('DROP TABLE IF EXISTS public.log')
      .then(() => queryInterface.sequelize.query('DROP TYPE IF EXISTS public.logLevelEnum'))
      .then(() => queryInterface.sequelize.query('DROP TABLE IF EXISTS public.outage'))
      .then(() => queryInterface.sequelize.query('DROP TYPE IF EXISTS public.outageTypeEnum'));
  },
};
