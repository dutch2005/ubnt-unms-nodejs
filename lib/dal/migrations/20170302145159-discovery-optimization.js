'use strict';

const upQueries = [
  `
  TRUNCATE TABLE discovery_device CASCADE;
  `,
  `
  TRUNCATE TABLE discovery_result CASCADE;
  `,
  `
  ALTER TYPE discoveryConnectStatusEnum RENAME TO discoveryConnectStatusEnum__;
  `,
  `
  CREATE TYPE discoveryConnectStatusEnum AS ENUM (
    'connected',
    'pending',
    'unconnected'
  );
  `,
  `
  ALTER TABLE discovery_device 
    ALTER COLUMN connect_status TYPE discoveryConnectStatusEnum 
    USING connect_status::text::discoveryConnectStatusEnum;
  `,
  `
  DROP TYPE discoveryConnectStatusEnum__;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN ssh_username;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN ssh_password;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN ssh_port;
  `,
  `
  CREATE TYPE discoveryConnectProgressEnum AS ENUM (
    'failed',
    'firmware-upgrade',
    'setting-connection-string',
    'waiting'
  );
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN connect_progress discoveryConnectProgressEnum;
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
  ALTER TYPE discoveryConnectStatusEnum RENAME TO discoveryConnectStatusEnum__;
  `,
  `
  CREATE TYPE discoveryConnectStatusEnum AS ENUM (
    'connected',
    'pending',
    'ready',
    'unconnected'
  );
  `,
  `
  ALTER TABLE discovery_device 
    ALTER COLUMN connect_status TYPE discoveryConnectStatusEnum 
    USING connect_status::text::discoveryConnectStatusEnum;
  `,
  `
  DROP TYPE discoveryConnectStatusEnum__;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN ssh_username character varying;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN ssh_password character varying;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN ssh_port integer;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN connect_progress;
  `,
  `
  DROP TYPE discoveryconnectprogressenum
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
