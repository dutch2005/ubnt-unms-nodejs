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
 * @name DbMacAesKeyRepository~findOne
 * @param {?Object} [where]
 * @return {Promise.<DbMacAesKey>}
 */
const findOne = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM mac_aes_key
     ${buildWhereQuery(config, where, { model: config.models.macAesKeyModel })}
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.macAesKeyModel,
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbMacAesKeyRepository~findByMac
 * @param {string} mac
 * @return {Promise.<DbMacAesKey>}
 */
const findByMac = mac => reader(
  config => findOne({ where: { mac } }).run(config)
);

/**
 * @name DbMacAesKeyRepository~findAll
 * @param {Object} [where]
 * @return {Promise.<DbMacAesKey[]>}
 */
const findAll = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM mac_aes_key
     ${buildWhereQuery(config, where, { model: config.models.macAesKeyModel })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.macAesKeyModel,
      mapToModel: true,
    }
  )
);

/**
 * @name DbMacAesKeyRepository~save
 * @param {string} id
 * @param {string} mac
 * @param {string} key
 * @param {MacAesKeyExchangeStatusEnum} exchangeStatus
 * @param {Date} lastSeen
 * @param {string} ip
 * @param {string} model
 * @return {Promise.<DbMacAesKey>}
 */
const save = ({ id, mac, key, exchangeStatus, ip, model, lastSeen = new Date() }) => reader(
  config => config.query(
    `INSERT INTO mac_aes_key (
        id, mac, key, exchange_status, last_seen, ip, model
     ) VALUES (
        $id, $mac, $key, $exchangeStatus, $lastSeen, $ip, $model
     )
     RETURNING *
      `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.macAesKeyModel,
      bind: { id, mac, key, exchangeStatus, lastSeen, ip, model },
      mapToModel: true,
    }
  ).then(single)
);

/**
 * @name DbMacAesKeyRepository~update
 * @param {string} id
 * @param {string} mac
 * @param {string} key
 * @param {MacAesKeyExchangeStatusEnum} exchangeStatus
 * @param {Date} lastSeen
 * @param {string} ip
 * @param {string} model
 * @return {Promise.<DbMacAesKey>}
 */
const update = ({ id, mac, key, exchangeStatus, ip, model, lastSeen = new Date() }) => reader(
  config => config.query(
    `UPDATE mac_aes_key 
     SET ${isUndefined(mac) ? '' : 'mac = $mac,'}
         ${isUndefined(key) ? '' : 'key = $key,'}
         ${isUndefined(exchangeStatus) ? '' : 'exchange_status = $exchangeStatus,'}
         ${isUndefined(ip) ? '' : 'ip = $ip,'}
         ${isUndefined(model) ? '' : 'model = $model,'}
         ${isUndefined(lastSeen) ? '' : 'last_seen = $lastSeen'}
     WHERE id = $id
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.macAesKeyModel,
      bind: { id, mac, key, exchangeStatus, lastSeen, ip, model },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbMacAesKeyRepository~remove
 * @param {string} id of device
 * @return {void}
 */
const remove = id => reader(
  config => config.query(
    'DELETE FROM mac_aes_key WHERE id = $id',
    {
      type: QueryTypes.DELETE,
      model: config.models.macAesKeyModel,
      bind: { id },
    }
  )
);

/**
 * @alias DbMacAesKeyRepository
 */
module.exports = {
  findOne,
  findByMac,
  findAll,
  save,
  update,
  remove,
};
