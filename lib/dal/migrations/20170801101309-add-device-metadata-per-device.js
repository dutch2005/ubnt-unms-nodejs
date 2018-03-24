'use strict';

const { flatMap, get, reduce } = require('lodash/fp');

const { DB } = require('../../db');

const upQuery = deviceId => (
  `INSERT INTO device_metadata (id) VALUES ('${deviceId}')
    ON CONFLICT (id) DO NOTHING;
  `
);

module.exports = {
  up(queryInterface) {
    return DB.device.findAll()
      .then(flatMap(get(['identification', 'id'])))
      .then(reduce((acc, deviceId) =>
        acc.then(() => queryInterface.sequelize.query(upQuery(deviceId))),
        Promise.resolve()
      ));
  },
  down() {
    // cannot revert
  },
};
