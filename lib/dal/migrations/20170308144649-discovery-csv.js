'use strict';

const upQueries = [
  `
  TRUNCATE TABLE discovery_device CASCADE;
  `,
  `
  TRUNCATE TABLE discovery_result CASCADE;
  `,
  `
  ALTER TYPE discoveryMethodEnum RENAME TO discoveryMethodEnum___;
  `,
  `
  CREATE TYPE discoveryMethodEnum AS ENUM (
    'import',
    'ip-range'
  );
  `,
  `
  ALTER TABLE discovery_result 
    ALTER COLUMN method TYPE discoveryMethodEnum 
    USING method::text::discoveryMethodEnum;
  `,
  `
  DROP TYPE discoveryMethodEnum___;
  `,
  `
  ALTER TABLE discovery_result ADD COLUMN ip_list character varying[];
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
  ALTER TYPE discoveryMethodEnum RENAME TO discoveryMethodEnum___;
  `,
  `
  CREATE TYPE discoveryMethodEnum AS ENUM (
    'broadcast',
    'ip-range'
  );
  `,
  `
  ALTER TABLE discovery_result 
    ALTER COLUMN method TYPE discoveryMethodEnum 
    USING method::text::discoveryMethodEnum;
  `,
  `
  DROP TYPE discoveryMethodEnum___;
  `,
  `
  ALTER TABLE discovery_result DROP COLUMN ip_list;
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
