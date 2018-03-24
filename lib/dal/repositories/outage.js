'use strict';

const { Reader: reader } = require('monet');
const { Sequelize } = require('sequelize');
const { flow, head, get, zipObject } = require('lodash/fp');
const { reduce } = require('ramda');

const { QueryTypes } = Sequelize;

const { isNotUndefined, partitionToMaxSize } = require('../../util');
const { buildWhereQuery, buildLimitAndOffsetQuery, correspondenceToDb, knex } = require('../utils');

/*
 * Generic accessors
 */

const findOne = ({ where = {} } = {}) => reader(
  config => config.query(`SELECT * FROM outage ${buildWhereQuery(config, where, { model: config.models.outageModel })}`,
    {
      type: QueryTypes.SELECT,
      model: config.models.outageModel,
      mapToModel: true,
    }
  )
);

const findById = outageId => reader(
  config => findOne({ where: { id: outageId } }).run(config)
);

const findAll = ({ offset, limit, where = {} } = {}) => reader(
  config => config.query(
    'SELECT * FROM outage ' +
    `${buildWhereQuery(config, where, { model: config.models.outageModel })} ` +
    `ORDER BY start_timestamp DESC, id  ${buildLimitAndOffsetQuery(config, { limit, offset })}`,
    {
      type: QueryTypes.SELECT,
      model: config.models.outageModel,
      mapToModel: true,
    }
  )
);

const count = ({ where = {} } = {}) => reader(
  config => config.query(`SELECT COUNT(*) AS count FROM outage ${buildWhereQuery(config, where, {})}`)
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

const save = ({ id, startTimestamp, endTimestamp, site, device, type }) => reader(
  config => config.query(
    'INSERT INTO outage (id, start_timestamp, end_timestamp, device, site, type) ' +
    'VALUES ($id, $startTimestamp, $endTimestamp, $device, $site, $type) ON CONFLICT (id) DO UPDATE ' +
    'SET end_timestamp = EXCLUDED.end_timestamp',
    {
      type: QueryTypes.INSERT,
      bind: { id, startTimestamp, endTimestamp, device, site, type },
    }
  )
);

const bulkSave = outages => reader(
  config => flow(
    partitionToMaxSize(100),
    reduce((acc, data) => acc.then(() => config.query(
      `
        ${knex.table('outage').insert(correspondenceToDb(config.models.outageModel, data)).toString()}
        ON CONFLICT (id) DO UPDATE SET end_timestamp = EXCLUDED.end_timestamp
      `.trim(),
      {
        type: QueryTypes.INSERT,
      }
    )), Promise.resolve())
  )(outages)
);

const remove = ({ where = {} }) => reader(
  config => config.query(
    'DELETE FROM outage ' +
    `${buildWhereQuery(config, where, { model: config.models.outageModel })}`,
    {
      type: QueryTypes.DELETE,
      model: config.models.outageModel,
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
const requestParamsToWhere = ({ siteId, deviceId, query, period, minStartTimestamp, maxEndTimestamp, type } = {}) => {
  const criteria = [];

  if (isNotUndefined(type)) { criteria.push({ type }) }
  if (isNotUndefined(siteId)) { criteria.push(Sequelize.json('site.id', siteId)) }
  if (isNotUndefined(deviceId)) { criteria.push(Sequelize.json('device.id', deviceId)) }
  if (isNotUndefined(query)) { criteria.push({ 'device.name': { $iLike: `%${query}%` } }) }
  if (isNotUndefined(period)) { criteria.push({ end_timestamp: { $gt: (new Date(Date.now() - period)) } }) }
  if (isNotUndefined(minStartTimestamp)) {
    criteria.push({ start_timestamp: { $gt: new Date(parseInt(minStartTimestamp, 10)) } });
  }
  if (isNotUndefined(maxEndTimestamp)) {
    criteria.push({ end_timestamp: { $lt: new Date(parseInt(maxEndTimestamp, 10)) } });
  }

  return criteria.length > 0 ? { $and: criteria } : {};
};

const findAllByRequestParams = ({
  siteId, deviceId, query, period, minStartTimestamp, maxEndTimestamp, offset, limit, type,
} = {}) => reader(
  (config) => {
    const where = requestParamsToWhere({ siteId, deviceId, query, period, minStartTimestamp, maxEndTimestamp, type });
    return findAll({ where, offset, limit }).run(config);
  }
);

const countUnread = minStartTimestamp => reader(
  (config) => {
    const where = { start_timestamp: { $gt: new Date(parseInt(minStartTimestamp, 10)) } };
    return count({ where }).run(config);
  }
);

const findAggs = ({ where = {} }) => reader(
  config => config.query('SELECT type, COUNT(*) FROM outage ' +
    `${buildWhereQuery(config, where, { model: config.models.outageModel })} GROUP BY type`,
    {
      type: QueryTypes.SELECT,
      model: config.models.outageAggModel,
      mapToModel: true,
    }
  )
);

const findAggsByRequestParams = ({ siteId, deviceId, query, period, minStartTimestamp, maxEndTimestamp } = {}) =>
  reader((config) => {
    const where = requestParamsToWhere({ siteId, deviceId, query, period, minStartTimestamp, maxEndTimestamp });

    return findAggs({ where }).run(config);
  });

const removeOld = maxEndTimestamp => reader(
  (config) => {
    const where = { end_timestamp: { $lt: new Date(parseInt(maxEndTimestamp, 10)) } };
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
  bulkSave,

  removeOld,
  findAllByRequestParams,
  findAggs,
  findAggsByRequestParams,
  countUnread,
  removeByDeviceId,
};
