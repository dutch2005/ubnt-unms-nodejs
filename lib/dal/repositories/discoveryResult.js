'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');

const { QueryTypes } = Sequelize;

const { buildWhereQuery, single, singleOrDefault } = require('../utils');

/*
 * Generic accessors
 */

const findAll = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT * 
     FROM discovery_result
     ${buildWhereQuery(config, where, { model: config.models.discoveryResultModel })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.discoveryResultModel,
      mapToModel: true,
    }
  )
);

const findOne = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT * 
     FROM discovery_result
     ${buildWhereQuery(config, where, { model: config.models.discoveryResultModel })}
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.discoveryResultModel,
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

const findById = resultId => reader(
  config => findOne({ where: { id: resultId } }).run(config)
);

const findByUserId = userId => reader(
  config => findOne({ where: { userId } }).run(config)
);

const save = ({ id, userId, method, ipRangeInput, ipRangeParsed, ipList, status }) => reader(
  config => config.query(
    `INSERT INTO discovery_result (
      id, user_id, method, ip_range_input, ip_range_parsed, ip_list, status
     ) VALUES (
      $id, $userId, $method, $ipRangeInput, $ipRangeParsed::jsonb, $ipList, $status
     )
     RETURNING *
    `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.discoveryResultModel,
      bind: { id, userId, method, ipRangeInput, ipRangeParsed: JSON.stringify(ipRangeParsed), ipList, status },
      mapToModel: true,
    }
  ).then(single)
);

const updateStatus = (userId, status, error = null) => reader(
  config => config.query(
    `UPDATE discovery_result 
     SET status = $status, error = $error 
     WHERE user_id = $userId
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.discoveryResultModel,
      bind: { userId, status, error },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

const remove = userId => reader(
  config => config.query(
    'DELETE FROM discovery_result WHERE user_id = $userId',
    {
      type: QueryTypes.DELETE,
      model: config.models.discoveryResultModel,
      bind: { userId },
    }
  )
);

const removeAll = () => reader(
  config => config.query(
    'TRUNCATE discovery_result CASCADE',
    {
      type: QueryTypes.RAW,
      model: config.models.discoveryResultModel,
    }
  )
);

module.exports = {
  findAll,
  findOne,
  findByUserId,
  findById,
  save,
  updateStatus,
  remove,
  removeAll,
};
