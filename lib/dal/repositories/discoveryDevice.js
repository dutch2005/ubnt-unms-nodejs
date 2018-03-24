'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');
const { isUndefined } = require('lodash/fp');

const { buildWhereQuery, single, singleOrDefault } = require('../utils');

const { QueryTypes } = Sequelize;

/*
 * Generic accessors
 */

/**
 * @name DbDiscoveryDeviceRepository~findOne
 * @param {Object?} where
 * @return {Promise.<DbDiscoveryDevice|null>}
 */
const findOne = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM discovery_device
     ${buildWhereQuery(config, where, { model: config.models.discoveryDeviceModel })}
     LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.discoveryDeviceModel,
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbDiscoveryDeviceRepository~findAll
 * @param {Object} where
 * @return {Promise.<DbDiscoveryDevice[]>}
 */
const findAll = ({ where = {} } = {}) => reader(
  config => config.query(
    `SELECT *
     FROM discovery_device
     ${buildWhereQuery(config, where, { model: config.models.discoveryDeviceModel })}
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.discoveryDeviceModel,
      mapToModel: true,
    }
  )
);

/**
 * @name DbDiscoveryDeviceRepository~save
 * @param {string} id
 * @param {string} userId
 * @param {string} resultId
 * @param {string[]} possibleIds
 * @param {string} connectStatus
 * @param {string} firmwareVersion
 * @param {string} platformId
 * @param {string} model
 * @param {string} name
 * @param {string} mac
 * @param {string} ip
 * @param {string} type
 * @param {string} category
 * @param {number} uptime
 * @param {string[]} allIps
 * @param {string[]} allMacs
 * @return {Promise.<DbDiscoveryDevice>}
 */
const save = ({ id, userId, resultId, possibleIds, connectStatus, firmwareVersion, platformId, model, name, mac,
                ip, type, category, uptime }) => reader(
  config => config.query(
    `INSERT INTO discovery_device (
        id, user_id, result_id, possible_ids, connect_status, firmware_version, platform_id, model, name, mac, ip, 
        type, category, uptime
       ) VALUES (
        $id, $userId, $resultId, $possibleIds, $connectStatus, $firmwareVersion, $platformId, $model, $name, $mac, $ip, 
        $type, $category, $uptime 
       ) 
       ON CONFLICT (id, user_id) DO UPDATE 
       SET result_id = $resultId,
           possible_ids = $possibleIds,
           connect_status = $connectStatus,
           connect_error = NULL,
           firmware_version = $firmwareVersion,
           model = $model,
           name = $name,
           mac = $mac,
           ip = $ip,
           type = $type,
           category = $category,
           uptime = $uptime,
           updated_at = NOW()
       RETURNING *
      `,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.discoveryDeviceModel,
      bind: {
        id,
        userId,
        resultId,
        possibleIds,
        connectStatus,
        firmwareVersion,
        platformId,
        model,
        name,
        mac,
        ip,
        type,
        category,
        uptime,
      },
      mapToModel: true,
    }
  ).then(single)
);

/**
 * @name DbDiscoveryDeviceRepository~update
 * @param {string} id
 * @param {string} userId
 * @param {string} [name]
 * @param {Object} [preferences]
 * @param {string} [connectStatus]
 * @param {string} [connectProgress]
 * @param {?string} [connectError]
 * @param {string} [authenticationStatus]
 * @param {?string} [authenticationError]
 * @param {string} [firmwareVersion]
 * @param {string} [platformId]
 * @return {Promise.<DbDiscoveryDevice>}
 */
const update = ({
  id,
  userId,
  name,
  preferences,
  connectStatus,
  connectProgress,
  connectError,
  authenticationStatus,
  authenticationError,
  firmwareVersion,
  platformId,
}) => reader(
  config => config.query(
    `UPDATE discovery_device 
     SET ${isUndefined(name) ? '' : 'name = $name,'}
         ${isUndefined(preferences) ? '' : 'preferences = $preferences,'}
         ${isUndefined(connectStatus) ? '' : 'connect_status = $connectStatus,'}
         ${isUndefined(connectProgress) ? '' : 'connect_progress = $connectProgress,'}
         ${isUndefined(connectError) ? '' : 'connect_error = $connectError,'}
         ${isUndefined(authenticationStatus) ? '' : 'auth_status = $authenticationStatus,'} 
         ${isUndefined(authenticationError) ? '' : 'auth_error = $authenticationError,'}
         ${isUndefined(firmwareVersion) ? '' : 'firmware_version = $firmwareVersion,'}
         ${isUndefined(platformId) ? '' : 'platform_id = $platformId,'}
         updated_at = NOW()
     WHERE id = $id AND user_id = $userId
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.discoveryDeviceModel,
      bind: {
        id,
        userId,
        name,
        preferences,
        connectStatus,
        connectProgress,
        connectError,
        authenticationStatus,
        authenticationError,
        firmwareVersion,
        platformId,
      },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

/**
 * @name DbDiscoveryDeviceRepository~batchUpdate
 * @param {string[]} deviceIds
 * @param {string} userId
 * @param {Object} [preferences]
 * @param {?DiscoveryConnectStatusEnum} [connectStatus]
 * @param {?DiscoveryConnectProgressEnum} [connectProgress]
 * @param {?string} [connectError]
 * @param {?string} [authenticationStatus]
 * @param {?string} [authenticationError]
 * @return {Promise.<DbDiscoveryDevice[]>}
 */
const batchUpdate = (deviceIds, userId, {
  preferences, connectStatus, connectProgress, connectError, authenticationStatus, authenticationError,
}) => reader(
  config => config.query(
    `UPDATE discovery_device 
     SET ${isUndefined(preferences) ? '' : 'preferences = $preferences::jsonb,'} 
         ${isUndefined(connectStatus) ? '' : 'connect_status = $connectStatus,'} 
         ${isUndefined(connectProgress) ? '' : 'connect_progress = $connectProgress,'} 
         ${isUndefined(connectError) ? '' : 'connect_error = $connectError,'} 
         ${isUndefined(authenticationStatus) ? '' : 'auth_status = $authenticationStatus,'}
         ${isUndefined(authenticationError) ? '' : 'auth_error = $authenticationError,'}
         updated_at = NOW()
     ${buildWhereQuery(config, { id: { $in: deviceIds }, userId }, { model: config.models.discoveryDeviceModel })}
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.discoveryDeviceModel,
      bind: { preferences, connectStatus, connectProgress, connectError, authenticationStatus, authenticationError },
      mapToModel: true,
    }
  )
);

/**
 * @alias DbDiscoveryDeviceRepository
 */
module.exports = {
  findOne,
  findAll,
  save,
  update,
  batchUpdate,
};
