'use strict';

const upQueries = [
  `
  ALTER TABLE user_profile ADD COLUMN last_news_seen_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
  `,
];

const downQueries = [
  `
  ALTER TABLE user_profile DROP COLUMN last_news_seen_date;
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
