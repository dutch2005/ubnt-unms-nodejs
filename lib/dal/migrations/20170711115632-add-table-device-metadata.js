'use strict';

const upQueries = [
  `
  DROP TABLE IF EXISTS device_metadata;
  `,
  `
  CREATE TABLE device_metadata (
    id UUID PRIMARY KEY NOT NULL,
    failed_message_decryption BOOLEAN NOT NULL DEFAULT FALSE
  );
  `,
  `
  CREATE INDEX ON device_metadata(id);

  `,
];

const downQueries = [
  `
  DROP TABLE IF EXISTS device_metadata;
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
