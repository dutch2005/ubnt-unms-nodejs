'use strict';

const { get } = require('lodash/fp');
const { map, reduce, filter } = require('ramda');
const { isNotNil } = require('ramda-adjunct');

const { DB } = require('../../db');

const updateMacAesKeyExchangeStatus = mac => (
  `
  UPDATE mac_aes_key SET exchange_status = 'complete' WHERE mac = '${mac}';
  `
);

const upQueries = [
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS exchange_status;
  DROP TYPE IF EXISTS macAesKeyExchangeStatusEnum;
  `,
  `
  CREATE TYPE macAesKeyExchangeStatusEnum AS ENUM (
    'pending',
    'used',
    'complete'
  );
  `,
  `
  ALTER TABLE mac_aes_key 
    ADD COLUMN exchange_status macAesKeyExchangeStatusEnum DEFAULT 'pending' NOT NULL;
  `,
];

const downQueries = [
  `
  ALTER TABLE mac_aes_key DROP COLUMN IF EXISTS exchange_status;
  `,
  `
  DROP TYPE IF EXISTS macAesKeyExchangeStatusEnum;
  `,
];

module.exports = {
  up(queryInterface) {
    return upQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve())
      .then(() => DB.device.findAll())
      .then(map(get(['identification', 'mac'])))
      .then(filter(isNotNil))
      .then(reduce(
        (acc, mac) => acc.then(() => queryInterface.sequelize.query(updateMacAesKeyExchangeStatus(mac))),
        Promise.resolve()
      ));
  },
  down(queryInterface) {
    return downQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve());
  },
};
