'use strict';

const upQueries = [
  `
  TRUNCATE TABLE discovery_device CASCADE;
  `,
  `
  TRUNCATE TABLE discovery_result CASCADE;
  `,
  `
  ALTER TYPE discoveryStatusEnum RENAME TO discoveryConnectStatusEnum;
  `,
  `
  CREATE OPERATOR CLASS _uuid_ops DEFAULT 
    FOR TYPE _uuid USING gin AS 
    OPERATOR 1 &&(anyarray, anyarray), 
    OPERATOR 2 @>(anyarray, anyarray), 
    OPERATOR 3 <@(anyarray, anyarray), 
    OPERATOR 4 =(anyarray, anyarray), 
    FUNCTION 1 uuid_cmp(uuid, uuid), 
    FUNCTION 2 ginarrayextract(anyarray, internal, internal), 
    FUNCTION 3 ginqueryarrayextract(anyarray, internal, smallint, internal, internal, internal, internal), 
    FUNCTION 4 ginarrayconsistent(internal, smallint, anyarray, integer, internal, internal, internal, internal), 
    STORAGE uuid;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN possible_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
  `,
  `
  CREATE INDEX ON discovery_device USING gin (possible_ids);
  `,
  `
  ALTER TABLE discovery_device RENAME status TO connect_status;
  `,
  `
  ALTER TABLE discovery_device ADD COLUMN connect_error text;
  `,
];

const downQueries = [
  `
  ALTER TABLE discovery_device DROP COLUMN possible_ids;
  `,
  `
  DROP OPERATOR CLASS IF EXISTS _uuid_ops USING gin CASCADE;
  `,
  `
  ALTER TABLE discovery_device RENAME connect_status TO status;
  `,
  `
  ALTER TABLE discovery_device DROP COLUMN connect_error;
  `,
  `
  ALTER TYPE discoveryConnectStatusEnum RENAME TO discoveryStatusEnum;
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
