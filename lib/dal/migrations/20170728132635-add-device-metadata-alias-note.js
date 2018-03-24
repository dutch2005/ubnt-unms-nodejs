'use strict';

const upQueries = [
  `
  ALTER TABLE device_metadata DROP COLUMN IF EXISTS alias;
  ALTER TABLE device_metadata DROP COLUMN IF EXISTS note;
  `,
  `
  ALTER TABLE device_metadata
    ADD COLUMN alias VARCHAR(30);
  `,
  `
  ALTER TABLE device_metadata
    ADD COLUMN note TEXT;
  `,
];

const downQueries = [
  `
  ALTER TABLE device_metadata DROP COLUMN IF EXISTS alias;
  ALTER TABLE device_metadata DROP COLUMN IF EXISTS note;
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
