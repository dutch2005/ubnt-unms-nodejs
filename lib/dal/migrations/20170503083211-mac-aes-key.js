'use strict';

const upQueries = [
  `
  DROP TABLE IF EXISTS mac_aes_key;
  `,
  `
  CREATE TABLE mac_aes_key (
    id UUID PRIMARY KEY NOT NULL,
    mac MACADDR NOT NULL,
    key CHAR(44) NOT NULL
  );
  `,
  `
  CREATE INDEX ON mac_aes_key(mac);
  `,
];

const downQueries = [
  `
  DROP TABLE IF EXISTS mac_aes_key;
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
