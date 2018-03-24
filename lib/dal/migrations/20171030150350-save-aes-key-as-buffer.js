'use strict';

const upQueries = [
  `
  ALTER TABLE mac_aes_key ADD COLUMN key_bin bytea;
  `,
  `
  UPDATE mac_aes_key SET key_bin = decode(key, 'base64');
  `,
  `
  ALTER TABLE mac_aes_key DROP COLUMN key;
  `,
  `
  ALTER TABLE mac_aes_key RENAME key_bin TO key;
  ALTER TABLE mac_aes_key
     ALTER COLUMN key SET NOT NULL;
  `,
];

const downQueries = [
  `
  ALTER TABLE mac_aes_key ADD COLUMN key_txt CHAR(44);
  `,
  `
  UPDATE mac_aes_key SET key_txt = encode(key, 'base64')
  `,
  `
  ALTER TABLE mac_aes_key DROP COLUMN key;
  `,
  `
  ALTER TABLE mac_aes_key RENAME key_txt TO key;
  ALTER TABLE mac_aes_key
     ALTER COLUMN key SET NOT NULL;
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
