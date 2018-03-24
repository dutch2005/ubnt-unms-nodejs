'use strict';

const { reduceP } = require('ramda-adjunct');

const upQueries = [
  /**
   * Create user roles enum
   */
  `CREATE TYPE "userrole" as ENUM (
    'anonymous',
    'guest',
    'admin'
  );`,

  /**
   * Create user table
   */
  `CREATE TABLE "user" (
    id UUID PRIMARY KEY NOT NULL,
    username VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR NOT NULL UNIQUE,
    password VARCHAR(60) NOT NULL,
    totp_auth_enabled BOOLEAN NOT NULL DEFAULT '0',
    totp_auth_secret VARCHAR,
    role userrole NOT NULL
  );`,

  /**
   * Create user profile table
   */
  `CREATE TABLE "user_profile" (
    user_id UUID PRIMARY KEY NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    alerts BOOLEAN NOT NULL DEFAULT '0',
    presentation_mode BOOLEAN NOT NULL DEFAULT '0',
    force_password_change BOOLEAN NOT NULL DEFAULT '0',
    last_log_item_id UUID,
    table_config JSONB
  );`,
];

const downQueries = [
  /**
   * Remove user profile table
   */
  'DROP TABLE "user_profile";',

  /**
   * Remove user table
   */
  'DROP TABLE "user";',

  /**
   * Remove user role enum
   */
  'DROP TYPE "userrole";',
];

module.exports = {
  up(queryInterface) {
    return reduceP((acc, query) => queryInterface.sequelize.query(query), null, upQueries);
  },

  down(queryInterface) {
    return reduceP((acc, query) => queryInterface.sequelize.query(query), null, downQueries);
  },
};
