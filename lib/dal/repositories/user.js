'use strict';

const { QueryTypes } = require('sequelize');
const { Reader: reader } = require('monet');
const { defaultTo } = require('ramda');

const { singleOrDefault, buildWhereQuery, buildLimitAndOffsetQuery } = require('../utils');
const { UserRoleEnum } = require('../../enums');
const { thenP } = require('../../util');

const findAll = () => reader(
  config => config.query(
    'SELECT * FROM "user";',
    {
      type: QueryTypes.SELECT,
      model: config.models.userModel,
      mapToModel: true,
    }
  )
);

const find = ({ where = {}, limit = 100, offset = 0 }) => reader(
  config => config.query(
    `
      SELECT * FROM "user" ${buildWhereQuery(config, where, { model: config.models.userModel })}
      ${buildLimitAndOffsetQuery(config, { limit, offset })};
    `,
    {
      type: QueryTypes.SELECT,
      model: config.models.userModel,
      bind: { limit, offset },
      mapToModel: true,
    }
  )
);

const findOne = where => reader(
  config => find({ where, limit: 1 })
    .map(thenP(singleOrDefault(null)))
    .run(config)
);

const findById = id => findOne({ id });

const findByEmail = email => findOne({ email });

const findByUsername = username => findOne({ username });

const create = cmUser => reader(
  config => config.query(
    `
      INSERT INTO "user"
        VALUES ($id, $username, $email, $password, $totpAuthEnabled, $totpAuthSecret, $role);
    `,
    {
      type: QueryTypes.INSERT,
      bind: {
        id: cmUser.id,
        username: cmUser.username,
        email: cmUser.email,
        password: cmUser.password,
        totpAuthEnabled: cmUser.totpAuthEnabled,
        totpAuthSecret: cmUser.totpAuthSecret,
        role: defaultTo(UserRoleEnum.Admin, cmUser.role),
      },
    }
  )
);

const update = (userId, cmUser) => reader(
  config => config.query(
    `
      UPDATE "user"
        SET username=$username, email=$email, password=$password,
        totp_auth_enabled=$totpAuthEnabled, totp_auth_secret=$totpAuthSecret,
        role=$role
        WHERE id=$id;
    `,
    {
      type: QueryTypes.UPDATE,
      bind: {
        id: userId,
        username: cmUser.username,
        email: cmUser.email,
        password: cmUser.password,
        totpAuthEnabled: cmUser.totpAuthEnabled,
        totpAuthSecret: cmUser.totpAuthSecret,
        role: cmUser.role,
      },
    }
  )
);

const setPasswordByUsername = (username, password) => reader(
  config => config.query(
    `
      UPDATE "user" 
        SET password=$password, totp_auth_enabled=FALSE, totp_auth_secret=NULL
        WHERE username=$username;
    `,
    {
      type: QueryTypes.UPDATE,
      bind: {
        username,
        password,
      },
    }
  )
);

const listUsernamesAndEmails = () => reader(
  config => config.query(
    'SELECT username, email FROM "user";',
    {
      type: QueryTypes.SELECT,
    }
  )
);

const remove = userId => reader(
  config => config.query(
    `
      DELETE FROM "user"
        WHERE id=$id;
    `,
    {
      type: QueryTypes.DELETE,
      bind: { id: userId },
    }
  )
);

const count = () => reader(
  config => config.query(
    'SELECT COUNT(*) FROM "user"',
    {
      type: QueryTypes.SELECT,
    }
  )
);

module.exports = {
  findAll,
  find,
  findOne,
  findById,
  findByEmail,
  findByUsername,
  create,
  update,
  remove,
  count,
  setPasswordByUsername,
  listUsernamesAndEmails,
};
