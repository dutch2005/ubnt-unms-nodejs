'use strict';

const upQueries = [
  `
  CREATE TYPE discoveryStatusEnum AS ENUM (
    'connected',
    'ready',
    'pending',
    'unconnected'
  );
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
  CREATE TYPE discoveryAuthenticationStatusEnum AS ENUM (
    'success',
    'failed',
    'in-progress',
    'canceled'
  );
  `,
  `
  CREATE TYPE discoveryMethodEnum AS ENUM (
    'broadcast',
    'ip-range'
  );
  `,
  `
  CREATE TYPE discoveryResultStatusEnum AS ENUM (
    'success',
    'failed',
    'in-progress',
    'canceled'
  );
  `,
  `
  CREATE TABLE discovery_result (
    id UUID PRIMARY KEY NOT NULL,
    user_id UUID NOT NULL UNIQUE,
    method discoveryMethodEnum NOT NULL,
    ip_range VARCHAR,
    status discoveryResultStatusEnum NOT NULL,
    error TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE discovery_device (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    result_id UUID,
    status discoveryStatusEnum NOT NULL,
    flags JSONB NOT NULL default '{}',
    firmware_version VARCHAR NOT NULL,
    model VARCHAR NOT NULL,
    "name" VARCHAR,
    mac VARCHAR NOT NULL,
    ip VARCHAR NOT NULL,
    serial_number VARCHAR,
    type discoveryDeviceTypeEnum NOT NULL,
    category discoveryDeviceCategoryEnum NOT NULL,
    site_id UUID,
    authorized BOOLEAN NOT NULL,
    ssh_username VARCHAR,
    ssh_password VARCHAR,
    ssh_port INTEGER,
    auth_status discoveryAuthenticationStatusEnum,
    auth_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY ( id, user_id ),
    FOREIGN KEY ( result_id ) REFERENCES discovery_result ON DELETE SET NULL
  );
  `,
  `
  CREATE INDEX ON discovery_device(site_id);
  `,
  `
  CREATE INDEX ON discovery_device(user_id);
  `,
  `
  CREATE INDEX ON discovery_result(user_id);
  `,
];

const downQueries = [
  `
  DROP TABLE IF EXISTS discovery_device;
  `,
  `
  DROP TABLE IF EXISTS discovery_result;
  `,
  `
  DROP TYPE IF EXISTS discoveryStatusEnum;
  `,
  `
  DROP TYPE IF EXISTS discoveryDeviceTypeEnum;
  `,
  `
  DROP TYPE IF EXISTS discoveryDeviceCategoryEnum;
  `,
  `
  DROP TYPE IF EXISTS discoveryAuthenticationStatusEnum;
  `,
  `
  DROP TYPE IF EXISTS discoveryMethodEnum;
  `,
  `
  DROP TYPE IF EXISTS discoveryResultStatusEnum;
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
