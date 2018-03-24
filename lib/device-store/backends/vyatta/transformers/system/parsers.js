'use strict';

const { defaultTo, pathEq, when } = require('ramda');
const { flow, getOr, head, toPairs, find } = require('lodash/fp');
const { isNotNil } = require('ramda-adjunct');

const timezones = require('./timezones');

/**
 * @typedef {Object} CorrespondenceVyattaSystem
 * @property {string} name
 * @property {string} timezone
 * @property {string[]} timezoneList
 * @property {string} gateway
 * @property {string} domainName
 * @property {string} dns1
 * @property {string} dns2
 * @property {Object} admin
 * @property {Object} admin.login
 * @property {?string} admin.login.username
 * @property {?string} [admin.login.password]
 * @property {Object} readOnlyAccount
 * @property {boolean} readOnlyAccount.enabled
 * @property {Object} readOnlyAccount.login
 * @property {?string} readOnlyAccount.login.username
 * @property {?string} [readOnlyAccount.login.password]
 */

/**
 * @function parseAdminUser
 * @param {Object} hwDeviceConfig
 * @return {{ login: ?string }}
 */
const parseAdminUser = flow(
  getOr({}, ['data', 'system', 'login', 'user']),
  toPairs,
  find(pathEq([1, 'level'], 'admin')),
  when(isNotNil, flow(head, username => ({ login: { username } }))),
  defaultTo({ login: null })
);

/**
 * @function parseReadOnlyAccount
 * @param {Object} hwDeviceConfig
 * @return {{ enabled: boolean, login: ?string }}
 */
const parseReadOnlyAccount = flow(
  getOr({}, ['data', 'system', 'login', 'user']),
  toPairs,
  find(pathEq([1, 'level'], 'operator')),
  when(isNotNil, flow(head, username => ({ enabled: true, login: { username } }))),
  defaultTo({ enabled: false, login: null })
);

/**
 * @param {Object} hwSystem
 * @return {CorrespondenceVyattaSystem}
 */
const parseHwSystem = hwSystem => ({
  name: getOr('', ['data', 'system', 'host-name'], hwSystem),
  timezone: getOr(null, ['data', 'system', 'time-zone'], hwSystem),
  timezoneList: timezones,
  gateway: getOr(null, ['data', 'system', 'gateway-address'], hwSystem),
  domainName: getOr('ubnt', ['data', 'system', 'domain-name'], hwSystem),
  dns1: getOr(null, ['data', 'system', 'name-server', '0'], hwSystem),
  dns2: getOr(null, ['data', 'system', 'name-server', '1'], hwSystem),
  admin: parseAdminUser(hwSystem),
  readOnlyAccount: parseReadOnlyAccount(hwSystem),
});

module.exports = {
  parseHwSystem,
};
