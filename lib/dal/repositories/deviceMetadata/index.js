'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');
const { isUndefined } = require('lodash/fp');

const { buildWhereQuery, single, singleOrDefault } = require('../../utils');

const { QueryTypes } = Sequelize;

/*
 * Generic accessors
 */

/**
 * @name DbDeviceMetadataRepository~findOne
 * @param {?Object} [where]
 * @return {Promise.<DbDeviceMetadata>}
 */
const findOne = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM device_metadata
     ${buildWhereQuery(config, where, { model: config.models.deviceMetadataModel })}
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.deviceMetadataModel,
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbDeviceMetadataRepository~findById
 * @param {string} id
 * @return {Promise.<DbDeviceMetadata>}
 */
const findById = id => findOne({ where: { id } });

/**
 * @name DbDeviceMetadataRepository~findAll
 * @param {Object} [where]
 * @return {Promise.<DbDeviceMetadata[]>}
 */
const findAll = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM device_metadata
     ${buildWhereQuery(config, where, { model: config.models.deviceMetadataModel })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.deviceMetadataModel,
      mapToModel: true,
    }
  )
);

/**
 * @name DbDeviceMetadataRepository~findRestarting
 * @return {Promise.<string[]>}
 */
const findRestarting = () => reader(
  config => config.query(
    'SELECT id FROM device_metadata WHERE restart_timestamp IS NOT NULL',
    {
      type: QueryTypes.SELECT,
      raw: true,
    }
  )
);

/**
 * @name DbDeviceMetadataRepository~save
 * @param {string} id
 * @param {boolean} failedMessageDecryption
 * @param {date} restartTimestamp
 * @param {string} alias
 * @param {string} note
 * @return {Promise.<DbDeviceMetadata>}
 */
const save = ({ id, failedMessageDecryption, restartTimestamp, alias, note }) => reader(
  config => config.query(
    `INSERT INTO device_metadata (
        id, failed_message_decryption, restart_timestamp, alias, note
       ) VALUES (
        $id, $failedMessageDecryption, $restartTimestamp, $alias, $note
       ) 
       ON CONFLICT (id) DO UPDATE 
       SET failed_message_decryption = $failedMessageDecryption,
           restart_timestamp = $restartTimestamp,
           alias = $alias,
           note = $note
       RETURNING *
      `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.deviceMetadataModel,
      bind: { id, failedMessageDecryption, restartTimestamp, alias, note },
      mapToModel: true,
    }
  ).then(single)
);

/**
 * @name DbDeviceMetadataRepository~update
 * @param {string} id
 * @param {boolean} [failedMessageDecryption]
 * @param {date} [restartTimestamp]
 * @param {string} [alias]
 * @param {string} [note]
 * @return {Promise.<DbDeviceMetadata>}
 */
const update = ({ id, failedMessageDecryption, restartTimestamp, alias, note }) => reader(
  config => config.query(
    `UPDATE device_metadata
     SET ${isUndefined(failedMessageDecryption) ? '' : 'failed_message_decryption = $failedMessageDecryption,'}
         ${isUndefined(restartTimestamp) ? '' : 'restart_timestamp = $restartTimestamp,'}
         ${isUndefined(alias) ? '' : 'alias = $alias,'}
         ${isUndefined(note) ? '' : 'note = $note,'}
         id = id
     WHERE id = $id
     RETURNING *
    `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.deviceMetadataModel,
      bind: { id, failedMessageDecryption, restartTimestamp, alias, note },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbDeviceMetadataRepository~remove
 * @param {string} id of device
 * @return {void}
 */
const remove = id => reader(
  config => config.query(
    'DELETE FROM device_metadata WHERE id = $id',
    {
      type: QueryTypes.DELETE,
      model: config.models.deviceMetadataModel,
      bind: { id },
    }
  )
);


/**
 * @alias DbDeviceMetadataRepository
 */
module.exports = {
  findOne,
  findById,
  findAll,
  findRestarting,
  save,
  update,
  remove,
};
