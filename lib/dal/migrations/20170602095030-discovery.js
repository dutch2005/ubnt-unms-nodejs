'use strict';

const upQueries = [
  `
  TRUNCATE TABLE discovery_device CASCADE;
  `,
  `
  TRUNCATE TABLE discovery_result CASCADE;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN platform_id VARCHAR;
  `,
];

const downQueries = [
  `
  TRUNCATE TABLE discovery_device CASCADE;
  `,
  `
  TRUNCATE TABLE discovery_result CASCADE;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN platform_id;
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
