'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');
const { zipObject, flow, get, head, castArray } = require('lodash/fp');

const { QueryTypes } = Sequelize;

const { isNotUndefined } = require('../../util');
const { buildWhereQuery, buildLimitAndOffsetQuery } = require('../utils');

/*
 * Generic accessors
 */

const findOne = ({ where = {} } = {}) => reader(
  config => config.query(`SELECT * FROM log ${buildWhereQuery(config, where, { model: config.models.logModel })}`,
    {
      type: QueryTypes.SELECT,
      model: config.models.logModel,
      mapToModel: true,
    }
  )
);

const findById = logId => reader(
  config => findOne({ where: { id: logId } }).run(config)
);


const findAll = ({ offset, limit, where = {} } = {}) => reader(
  config => config.query(
    `SELECT * FROM log ${buildWhereQuery(config, where, { model: config.models.logModel })} ` +
    ` ORDER BY timestamp DESC, id ${buildLimitAndOffsetQuery(config, { limit, offset })}`,
    {
      type: QueryTypes.SELECT,
      model: config.models.logModel,
      mapToModel: true,
    }
  )
);

const count = ({ where = {} } = {}) => reader(
  config => config.query(`SELECT COUNT(*) AS count FROM log ${buildWhereQuery(config, where, {})}`)
    .then(flow(head, head, get('count'), Number))
);

const findAndCountAll = ({ offset, limit, where = {} } = {}) => reader(
  (config) => {
    const rowsPromise = findAll({ offset, limit, where }).run(config);
    const countPromise = count({ where }).run(config);
    return Promise.all([rowsPromise, countPromise])
      .then(zipObject(['rows', 'count']));
  }
);

const save = ({
  id,
  message,
  level,
  type,
  timestamp,
  site,
  device,
  tags,
  mailNotificationEmails,
  mailNotificationTimestamp,
  user,
  token,
  remoteAddress,
}) => reader(config => config.query(
  'INSERT INTO log (id, message, level, type, timestamp, site, device, tags, ' +
  'mail_notification_emails, mail_notification_timestamp, "user", token, remote_address) ' +
  'VALUES ($id, $message, $level, $type, $timestamp, $site, $device, $tags, $mailNotificationEmails, ' +
  '$mailNotificationTimestamp, $user, $token, $remoteAddress) ON CONFLICT (id) DO NOTHING',
  {
    type: QueryTypes.INSERT,
    bind: {
      id,
      message,
      level,
      type,
      timestamp,
      site,
      device,
      tags,
      mailNotificationEmails,
      mailNotificationTimestamp,
      user,
      token,
      remoteAddress,
    },
  })
);

const update = ({ id, mailNotificationEmails, mailNotificationTimestamp }) => reader(
  config => config.query(
    'UPDATE log SET mail_notification_emails=$mailNotificationEmails, ' +
    'mail_notification_timestamp=$mailNotificationTimestamp WHERE id=$id',
    {
      type: QueryTypes.UPDATE,
      bind: { id, mailNotificationEmails, mailNotificationTimestamp },
    }
  )
);

const remove = ({ where = {} }) => reader(
  config => config.query(
    `DELETE FROM log ${buildWhereQuery(config, where, { model: config.models.logModel })}`,
    {
      type: QueryTypes.DELETE,
      model: config.models.logModel,
    }
  )
);


/*
 * Specialized accessors
 */

/*
 This utils may serve as a general use-case util for now. But if use-cases
 of the applications changes, this utils becomes specific to route definitions
 and I advice you to to move it in higher layer e.g. business logic or route definitions.
 */
const requestParamsToWhere = ({ siteId, deviceId, period, query, level, timestamp } = {}) => {
  const criteria = [];

  if (isNotUndefined(siteId)) { criteria.push(Sequelize.json('site.id', siteId)) }
  if (isNotUndefined(deviceId)) { criteria.push(Sequelize.json('device.id', deviceId)) }
  if (isNotUndefined(period)) { criteria.push({ timestamp: { $gt: (new Date(Date.now() - period)) } }) }
  if (isNotUndefined(query)) { criteria.push({ message: { $iLike: `%${query}%` } }) }
  if (isNotUndefined(level)) { criteria.push({ level: { $in: castArray(level) } }) }
  if (isNotUndefined(timestamp)) { criteria.push({ timestamp: { $gt: new Date(parseInt(timestamp, 10)) } }) }

  return criteria.length > 0 ? { $and: criteria } : {};
};

const findAllByRequestParams = ({ siteId, deviceId, period, query, level, timestamp, offset, limit } = {}) => reader(
  (config) => {
    const where = requestParamsToWhere({ siteId, deviceId, period, query, level, timestamp });
    return findAll({ where, offset, limit }).run(config);
  }
);

const findAggs = ({ where }) => reader(
  config => config.query(
    'SELECT level, COUNT(*) as count FROM log ' +
    `${buildWhereQuery(config, where, { model: config.models.logAggModel })} GROUP BY level`,
    {
      type: QueryTypes.SELECT,
      model: config.models.logAggModel,
      mapToModel: true,
    }
  )
);

const findAggsByRequestParams = ({ siteId, deviceId, period, query, level, timestamp } = {}) => reader(
  (config) => {
    const where = requestParamsToWhere({ siteId, deviceId, period, query, level, timestamp });
    return findAggs({ where }).run(config);
  }
);

const countUnread = ({ timestamp, level }) => reader(
  (config) => {
    const where = [{ timestamp: { $gt: new Date(parseInt(timestamp, 10)) } }];
    if (isNotUndefined(level)) { where.push({ level: { $in: castArray(level) } }) }

    return count({ where }).run(config);
  }
);

const removeOld = maxTimestamp => reader(
  (config) => {
    const where = { timestamp: { $lt: new Date(parseInt(maxTimestamp, 10)) } };
    return remove({ where }).run(config);
  }
);

const removeByDeviceId = deviceId => reader(
  config => remove({
    where: Sequelize.json('device.id', deviceId),
  }).run(config)
);

module.exports = {
  findById,
  findOne,
  findAll,
  findAndCountAll,
  count,
  save,
  update,
  remove,

  findAllByRequestParams,
  findAggs,
  findAggsByRequestParams,
  countUnread,
  removeOld,
  removeByDeviceId,
};
