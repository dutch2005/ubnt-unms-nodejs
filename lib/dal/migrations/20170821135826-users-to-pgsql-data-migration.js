'use strict';

const aguid = require('aguid');
const {
  pipe, assocPath, propEq, merge, map, defaultTo, always, ifElse, head, view, applySpec, lensPath, flatten,
} = require('ramda');
const { isNilOrEmpty, reduceP, noop } = require('ramda-adjunct');

const { DB: { redis: redisClient } } = require('../../db');
const { allP } = require('../../util');

module.exports = {
  up(queryInterface) {
    /**
     * Load users from Redis
     */
    const usersRawP = redisClient.keysAsync('user:*')
      .then(keys => new Promise((resolve, reject) => {
        const batch = redisClient.batch();
        keys.forEach(key => batch.get(key));
        return batch.execAsync((err, results) => {
          if (err) return reject(err);
          return resolve(results);
        });
      }));

    /**
     * Load profiles from Redis
     */
    const userProfilesRawP = redisClient.keysAsync('userProfile:*')
      .then(keys => new Promise((resolve, reject) => {
        const batch = redisClient.batch();
        keys.forEach(key => batch.get(key));
        return batch.execAsync((err, results) => {
          if (err) return reject(err);
          return resolve(results);
        });
      }));

    /**
     * Merge users and profiles
     */
    return allP([usersRawP, userProfilesRawP])
      .then(([users, profiles]) => [
        users.map(u => JSON.parse(u)),
        profiles.map(p => JSON.parse(p)),
      ])
      .then(([users, profiles]) => users.map(user =>
        pipe(
          assocPath(['id'], user.id),
          assocPath(['username'], user.username),
          assocPath(['email'], user.email),
          assocPath(['password'], user.password),
          assocPath(['totpAuthEnabled'], user.totpAuthEnabled),
          assocPath(['totpAuthSecret'], user.totpAuthSecret),
          assocPath(['profile'], merge({ alerts: user.alerts }, profiles.find(propEq('userId', user.id))))
        )({})
      ))

    /**
     * Generate Postgres queries
     */
    .then(map(
      user => [
        // make sure we don't violate UNIQUE constraints on id, username and email
        `
          DELETE FROM "user_profile" WHERE user_id = '${user.id}'
        `,
        `
          DELETE FROM "user" WHERE id = '${user.id}'
        `,
        `
          DELETE FROM "user" WHERE username = '${user.username}'
        `,
        // we agreed that it's better to lose a user than to have multiple users with the same email
        `
          DELETE FROM "user" WHERE email = '${user.email}'
        `,
        `
          INSERT INTO "user" VALUES (
            '${user.id}', '${user.username}', '${user.email}', '${user.password}',
            '${defaultTo(false, user.totpAuthEnabled).toString()}',
            ${ifElse(isNilOrEmpty, always('NULL'), d => `'${d}'`)(user.totpAuthSecret)},
            'admin'
          );
        `,
        `
          INSERT INTO "user_profile" VALUES (
            '${user.id}',
            '${defaultTo(false, user.profile.alerts).toString()}',
            '${defaultTo(false, user.profile.presentationMode).toString()}',
            '${defaultTo(false, user.profile.forceChangePassword).toString()}'
          );
        `,
      ]
    ))
    .then(flatten)

    /**
     * Run queries in series
     */
    .then(reduceP((acc, query) => queryInterface.sequelize.query(query), null))

    /**
     * Remove profiles from Redis
     */
    .then(
      () => redisClient.evalAsync("return redis.call('del', unpack(redis.call('keys', ARGV[1])))", 0, 'userProfile:*')
        .catch(noop) // swallow errors related to non-existent hash.
    )

    /**
     * Remove users from Redis
     */
    .then(
      () => redisClient.evalAsync("return redis.call('del', unpack(redis.call('keys', ARGV[1])))", 0, 'user:*')
        .catch(noop) // swallow errors related to non-existent hash.
    );
  },

  down(queryInterface) {
    /**
     * Fetch users & user profiles
     */
    return queryInterface.sequelize.query(`
      SELECT "user".id, "user".username, "user".email, "user".password, "user".totp_auth_enabled,
      "user".totp_auth_secret,"user_profile".alerts, "user_profile".presentation_mode,
      "user_profile".force_password_change
      FROM "user"
      JOIN "user_profile"
        ON "user".id = "user_profile".user_id
    `)

    /**
     * Extract response array
     */
    .then(head)

    /**
     * Remap data to proper format
     */
    .then(map(applySpec({
      user: {
        id: view(lensPath(['id'])),
        username: view(lensPath(['username'])),
        email: view(lensPath(['email'])),
        password: view(lensPath(['password'])),
        totpAuthEnabled: view(lensPath(['totp_auth_enabled'])),
        totpAuthSecret: view(lensPath(['totp_auth_secret'])),
        alerts: view(lensPath(['alerts'])),
      },
      userProfile: {
        presentationMode: view(lensPath(['presentation_mode'])),
        forceChangePassword: view(lensPath(['force_password_change'])),
      },
    })))

    /**
     * Insert data to Redis
     */
    .then(data => new Promise((resolve, reject) => {
      const batch = redisClient.batch();
      data.forEach((item) => {
        const profileId = aguid();
        batch.set(`user:${item.user.id}`, JSON.stringify(item.user));
        batch.set(
          `userProfile:${profileId}`,
          JSON.stringify(Object.assign({}, { id: profileId, userId: item.user.id }, item.userProfile))
        );
      });
      batch.execAsync((err) => {
        if (err) reject(err);
        else resolve();
      });
    }))

    /**
     * Drop all users and user profiles from Postgres
     */
    .then(() => queryInterface.sequelize.query('TRUNCATE "user" CASCADE'));
  },
};
