'use strict';

const upQueries = [
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS last_seen;
  `,
  `
  ALTER TABLE mac_aes_key ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
  `,
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS ip;
  `,
  `
  ALTER TABLE mac_aes_key ADD COLUMN ip VARCHAR;
  `,
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS model;
  `,
  `
  ALTER TABLE mac_aes_key ADD COLUMN model VARCHAR;
  `,
];

const downQueries = [
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS last_seen;
  `,
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS ip;
  `,
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS model;
  `,
];

module.exports = {
  up(queryInterface) {
    return upQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve());
  },
  down(queryInterface) {
    return downQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve());
  },
};
