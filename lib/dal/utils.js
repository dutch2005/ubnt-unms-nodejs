'use strict';

const { curry, isFunction, mapValues, first, defaultTo, has, cloneDeep, isPlainObject } = require('lodash/fp');
const { pipe, pathOr, when, map: rMap } = require('ramda');
const moment = require('moment-timezone');
const { length, anyPass } = require('ramda');
const { renameKeysWith, isNotArray, isArray } = require('ramda-adjunct');
const { isInt } = require('validator');
const { mapWhereFieldNames } = require('sequelize/lib/utils');
const knex = require('knex')({ client: 'pg' });

const { isMomentOrDate } = require('../util');


const formatDateTime = value => moment(value).format('YYYY-MM-DD HH:mm:ss.SSS Z');

const buildWhereQuery = curry((config, where, options) => {
  const { QueryGenerator } = config.getQueryInterface();
  const whereCriteria = cloneDeep(where);
  // ensure fields are properly renamed
  if (has('model', options)) {
    mapWhereFieldNames(whereCriteria, options.model);
  }
  return QueryGenerator.whereQuery(whereCriteria, options);
});

const buildLimitAndOffsetQuery = curry((config, { limit, offset }) => {
  const { QueryGenerator } = config.getQueryInterface();
  let query = '';
  if (isInt(String(limit))) {
    query += ` LIMIT ${QueryGenerator.escape(limit)}`;
  }
  if (isInt(String(offset))) {
    query += ` OFFSET ${QueryGenerator.escape(offset)}`;
  }
  return query;
});

const bindRepositoryFunc = curry((config, repositoryFunc) => (...args) => repositoryFunc(...args).run(config));

const bindRepository = curry((config, repository) => mapValues(bindRepositoryFunc(config), repository));

const runQueryOnConfig = curry((config, readerOrRepositoryFunction) => (...args) => {
  if (isFunction(readerOrRepositoryFunction)) {
    return bindRepositoryFunc(config, readerOrRepositoryFunction)(...args);
  }
  return readerOrRepositoryFunction.run(config);
});

const singleOrDefault = curry((defaultValue, items) => {
  if (length(items) > 1) { throw new Error('0 or 1 items expected') }
  return defaultTo(defaultValue, first(items));
});

const single = (items) => {
  if (length(items) !== 1) { throw new Error('Exactly 1 item expected') }
  return first(items);
};

const functorTrait = modelAccessor => ({
  // do not change to ES6 object shorthand for the sake of binding context
  map: function map(func) {
    const model = modelAccessor();
    return model.build(func(this.toJSON()));
  },
});

const getDbKey = curry((model, key) => pathOr(key, ['rawAttributes', key, 'field'], model));

const correspondenceToDb = curry((model, data) => pipe(
  when(isNotArray, Array),
  rMap(pipe(
    renameKeysWith(getDbKey(model)),
    mapValues(pipe(
      when(isMomentOrDate, formatDateTime),
      when(anyPass([isPlainObject, isArray]), JSON.stringify)
    ))
  ))
)(data));


module.exports = {
  runQueryOnConfig,
  buildWhereQuery,
  buildLimitAndOffsetQuery,
  formatDateTime,
  bindRepositoryFunc,
  bindRepository,
  functorTrait,
  singleOrDefault,
  single,
  correspondenceToDb,
  knex,
};
