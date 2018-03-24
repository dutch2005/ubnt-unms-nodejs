'use strict';

const upQueries = [
  `
  ALTER TABLE discovery_device DROP COLUMN flags;
  `,
];

const downQueries = [
  `
  ALTER TABLE public.discovery_device ADD COLUMN flags jsonb NOT NULL DEFAULT '{}'::jsonb;
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
