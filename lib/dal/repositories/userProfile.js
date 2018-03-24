'use strict';

const { QueryTypes } = require('sequelize');
const { Reader: reader } = require('monet');
const { isUndefined } = require('lodash/fp');
const { isNil } = require('ramda');

const { singleOrDefault, buildWhereQuery, buildLimitAndOffsetQuery } = require('../utils');
const { thenP } = require('../../util');

const findAll = ({ where = {}, limit = 100, offset = 0 } = {}) => reader(
  config => config.query(
    `SELECT * FROM "user_profile" ${buildWhereQuery(config, where, { model: config.models.userProfileModel })}
    ${buildLimitAndOffsetQuery(config, { limit, offset })};`,
    {
      type: QueryTypes.SELECT,
      model: config.models.userProfileModel,
      mapToModel: true,
    }
  )
);

const findOne = where => reader(
  config => findAll({ where, limit: 1 })
    .map(thenP(singleOrDefault(null)))
    .run(config)
);

const findByUserId = userId => findOne({ userId });

const upsert = ({
  userId,
  forceChangePassword = true,
  alerts = false,
  presentationMode = false,
  lastLogItemId = null,
  tableConfig = null,
} = {}) => reader(
  config => config.query(
    `
      INSERT INTO "user_profile"
        VALUES ($userId, $alerts, $presentationMode, $forceChangePassword, $lastLogItemId, $tableConfig)
        ON CONFLICT (user_id) DO UPDATE 
          SET alerts=$alerts, presentation_mode=$presentationMode, force_password_change=$forceChangePassword,
          last_log_item_id=$lastLogItemId, table_config=$tableConfig;
    `,
    {
      type: QueryTypes.INSERT,
      model: config.models.userProfileModel,
      bind: {
        userId,
        alerts,
        presentationMode,
        forceChangePassword,
        lastLogItemId,
        tableConfig,
      },
    }
  )
);

/**
 * @name DbUserProfileRepository~update
 * @param {string} userId
 * @param {?boolean} forceChangePassword
 * @param {?boolean} alerts
 * @param {?boolean} presentationMode
 * @param {?string} lastLogItemId
 * @param {?TableConfig} tableConfig
 * @param {?Date} lastNewsSeenDate
 * @return {Promise.<DbUserProfile>}
 */
const update = ({
  userId, forceChangePassword, alerts, presentationMode, lastLogItemId, tableConfig, lastNewsSeenDate,
}) => reader(
  config => config.query(
    `UPDATE user_profile 
     SET ${isUndefined(forceChangePassword) ? '' : 'force_password_change = $forceChangePassword,'}
         ${isUndefined(alerts) ? '' : 'alerts = $alerts,'}
         ${isUndefined(presentationMode) ? '' : 'presentation_mode = $presentationMode,'} 
         ${isUndefined(lastLogItemId) ? '' : 'last_log_item_id = $lastLogItemId,'}
         ${isUndefined(tableConfig) ? '' : 'table_config = $tableConfig,'}
         ${isNil(lastNewsSeenDate) ? '' : 'last_news_seen_date = $lastNewsSeenDate,'}
         user_id = user_id
     WHERE user_id = $userId
     RETURNING *`,
    {
      type: QueryTypes.SELECT, // intentionally select
      model: config.models.userProfileModel,
      bind: {
        userId,
        alerts,
        presentationMode,
        forceChangePassword,
        lastLogItemId,
        tableConfig,
        lastNewsSeenDate,
      },
      mapToModel: true,
    }
  ).then(singleOrDefault(null))
);

const remove = userId => reader(
  config => config.query(
    `
    DELETE FROM "user_profile"
    ${buildWhereQuery(config, { userId }, { model: config.models.userProfileModel })}
    `,
    {
      type: QueryTypes.DELETE,
    }
  )
);

module.exports = {
  findAll,
  findByUserId,
  upsert,
  update,
  remove,
};
