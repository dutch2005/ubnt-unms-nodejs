'use strict';

const upQueries = [
  `
  ALTER TABLE discovery_result RENAME ip_range TO ip_range_input;
  `,
  `
  ALTER TABLE discovery_result ALTER COLUMN ip_range_input TYPE text;
  `,
  `
  ALTER TABLE discovery_result ADD COLUMN ip_range_parsed jsonb;
  `,
];

const downQueries = [
  `
  ALTER TABLE discovery_result RENAME ip_range_input TO ip_range;
  `,
  `
  ALTER TABLE discovery_result ALTER COLUMN ip_range TYPE character varying;
  `,
  `
  ALTER TABLE discovery_result DROP COLUMN ip_range_parsed;
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
