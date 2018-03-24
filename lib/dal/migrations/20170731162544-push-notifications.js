'use strict';

module.exports = {
  up(queryInterface) {
    return queryInterface.sequelize.query(
      "CREATE TYPE mobileDevicePlatformEnum AS ENUM ('ios', 'android');"
    ).then(() => queryInterface.sequelize.query(
      'CREATE TABLE public.mobile_device( ' +
      'id uuid PRIMARY KEY NOT NULL, ' +
      'user_id uuid NOT NULL, ' +
      'name char(64) NOT NULL, ' +
      'platform mobileDevicePlatformEnum NOT NULL, ' +
      'timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), ' +
      'token TEXT NOT NULL, ' +
      'device_key uuid NOT NULL,' +
      'CONSTRAINT c_unique_mobile_device UNIQUE (user_id, token)' +
      ');'
    ));
  },

  down(queryInterface) {
    return queryInterface.sequelize.query(
      'DROP TABLE IF EXISTS public.mobile_device CASCADE'
    ).then(() => queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS public.mobileDevicePlatformEnum CASCADE'
    ));
  },
};
