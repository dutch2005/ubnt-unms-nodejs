'use strict';

const upQueries = [
  `
  ALTER TABLE discovery_device ADD COLUMN uptime BIGINT DEFAULT NULL;
  `,
];

const downQueries = [
  `
  ALTER TABLE discovery_device DROP COLUMN uptime;
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
