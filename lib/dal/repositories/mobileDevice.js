'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');

const { QueryTypes } = Sequelize;

const { buildWhereQuery } = require('../utils');

/*
 * Generic accessors
 */

const find = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT * FROM mobile_device ${buildWhereQuery(
      config, where, { model: config.models.mobileDeviceModel }
    )}`,
    {
      type: QueryTypes.SELECT,
      model: config.models.mobileDeviceModel,
      mapToModel: true,
    }
  )
);

const findById = mobileDeviceId => reader(
  config => find({ where: { id: mobileDeviceId } }).run(config)
);

const findByUserId = userId => reader(
  config => find({ where: { user_id: userId } }).run(config)
);

const save = ({ id, user_id, name, platform, token, device_key }) => reader(
  config => config.query(
    'INSERT INTO mobile_device (id, user_id, name, platform, token, device_key)' +
    'VALUES ($id, $user_id, $name, $platform, $token, $device_key)' +
    'ON CONFLICT ON CONSTRAINT c_unique_mobile_device DO NOTHING',
    {
      type: QueryTypes.INSERT,
      bind: {
        id,
        user_id,
        name,
        platform,
        token,
        device_key,
      },
    }
  )
);

const removeById = mobileDeviceId => reader(
  config => config.query(
    `DELETE from mobile_device ${buildWhereQuery(
      config, { id: mobileDeviceId }, { model: config.models.mobileDeviceModel }
    )}`,
    {
      type: QueryTypes.DELETE,
      model: config.models.mobileDeviceModel,
    }
  )
);

module.exports = {
  find,
  findById,
  findByUserId,
  save,
  removeById,
};
