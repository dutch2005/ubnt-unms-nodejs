'use strict';

const { isUndefined } = require('lodash/fp');
const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');

const { buildWhereQuery, single, singleOrDefault } = require('../utils');

const { QueryTypes } = Sequelize;

/*
 * Generic accessors
 */

/**
 * @name DbDataLinkRepository~findOne
 * @param {?Object} [where]
 * @return {Promise.<DbDataLink>}
 */
const findOne = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM data_link
     ${buildWhereQuery(config, where, { model: config.models.dataLinkModel })}
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.dataLinkModel,
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbMacAesKeyRepository~findByMac
 * @param {string} id
 * @return {Promise.<DbDataLink>}
 */
const findById = id => reader(
  config => findOne({ where: { id } }).run(config)
);

/**
 * @name DbDataLinkRepository~findAll
 * @param {Object} [where]
 * @return {Promise.<DbDataLink[]>}
 */
const findAll = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM data_link
     ${buildWhereQuery(config, where, { model: config.models.dataLinkModel })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.dataLinkModel,
      mapToModel: true,
    }
  )
);

/**
 * @name DbDataLinkRepository~save
 * @param {string} id UUID of Data Link
 * @param {string} deviceIdFrom UUID
 * @param {string} interfaceNameFrom STRING(50)
 * @param {string} deviceIdTo UUID
 * @param {string} interfaceNameTo STRING(50)
 * @param {DataLinkOriginEnum} origin
 * @return {Promise.<DbDataLink>}
 */
const save = ({ id, deviceIdFrom, interfaceNameFrom, deviceIdTo, interfaceNameTo, origin }) => reader(
  config => config.query(
    `INSERT INTO data_link (
        id, device_id_from, interface_name_from, device_id_to, interface_name_to, origin
     ) VALUES (
        $id, $deviceIdFrom, $interfaceNameFrom, $deviceIdTo, $interfaceNameTo, $origin
     )
     RETURNING *
      `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.dataLinkModel,
      bind: { id, deviceIdFrom, interfaceNameFrom, deviceIdTo, interfaceNameTo, origin },
      mapToModel: true,
    }
  ).then(single)
);

/**
 * @name DbDataLinkRepository~update
 * @param {string} id UUID of Data Link
 * @param {string} [deviceIdFrom] UUID
 * @param {string} [interfaceNameFrom] STRING(50)
 * @param {string} [deviceIdTo] UUID
 * @param {string} [interfaceNameTo] STRING(50)
 * @return {Promise.<DbDataLink>}
 */
const update = ({ id, deviceIdFrom, interfaceNameFrom, deviceIdTo, interfaceNameTo }) => reader(
  config => config.query(
    `UPDATE data_link 
     SET ${isUndefined(deviceIdFrom) ? '' : 'device_id_from = $deviceIdFrom,'}
         ${isUndefined(interfaceNameFrom) ? '' : 'interface_name_from = $interfaceNameFrom,'}
         ${isUndefined(deviceIdTo) ? '' : 'device_id_to = $deviceIdTo,'}
         ${isUndefined(interfaceNameTo) ? '' : 'interface_name_to = $interfaceNameTo,'}
         id = id
     WHERE id = $id
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.dataLinkModel,
      bind: { id, deviceIdFrom, interfaceNameFrom, deviceIdTo, interfaceNameTo },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbDataLinkRepository~remove
 * @param {string} id of Data Link
 * @return {void}
 */
const remove = id => reader(
  config => config.query(
    'DELETE FROM data_link WHERE id = $id',
    {
      type: QueryTypes.DELETE,
      model: config.models.dataLinkModel,
      bind: { id },
    }
  )
);

/**
 * @alias DbDataLinkRepository
 */
module.exports = {
  findOne,
  findById,
  findAll,
  save,
  update,
  remove,
};
