'use strict';

const upQueries = [
  `
  ALTER TABLE device_metadata DROP COLUMN IF EXISTS restart_timestamp;
  `,
  `
  ALTER TABLE device_metadata
    ADD COLUMN restart_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  `,
];

const downQueries = [
  `
  ALTER TABLE device_metadata DROP COLUMN IF EXISTS restart_timestamp;
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
