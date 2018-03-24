'use strict';

const upQueries = [
  `
  TRUNCATE TABLE discovery_device CASCADE;
  `,
  `
  TRUNCATE TABLE discovery_result CASCADE;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN authorized;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN site_id;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN serial_number;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN category;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN type;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN category VARCHAR NOT NULL;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN type VARCHAR NOT NULL;
  `,
  `
  DROP TYPE IF EXISTS discoveryDeviceTypeEnum;
  `,
  `
  DROP TYPE IF EXISTS discoveryDeviceCategoryEnum;
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
  ALTER TABLE discovery_device ADD COLUMN authorized boolean NOT NULL;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN site_id uuid;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN serial_number character varying;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN category;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN type;
  `,
  `
  CREATE TYPE discoveryDeviceTypeEnum AS ENUM (
    'onu',
    'olt',
    'erouter',
    'eswitch'
  );
  `,
  `
  CREATE TYPE discoveryDeviceCategoryEnum AS ENUM (
    'optical',
    'wired',
    'wireless'
  );
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN category discoveryDeviceCategoryEnum NOT NULL;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN type discoveryDeviceTypeEnum NOT NULL;
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
