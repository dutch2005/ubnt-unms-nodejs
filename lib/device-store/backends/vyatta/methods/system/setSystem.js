'use strict';

const { constant, isNull } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../messages');
const timezones = require('../../transformers/system/timezones');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceVyattaSystem} cmSystem
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function setSystem(cmSystem) {
  const setData = {};
  const deleteData = {};

  setData.system = {};
  setData.system['host-name'] = cmSystem.name;
  setData.system['time-zone'] = cmSystem.timezone;

  // admin.
  if (cmSystem.admin && cmSystem.admin.login && cmSystem.admin.login.password) {
    if (!setData.system.login) {
      setData.system.login = { user: {} };
    }
    setData.system.login.user[cmSystem.admin.login.username] = {
      level: 'admin',
      authentication: {
        'plaintext-password': cmSystem.admin.login.password,
      },
    };
  }

  // read only account.
  if (cmSystem.readOnlyAccount && cmSystem.readOnlyAccount.enabled &&
    cmSystem.readOnlyAccount.login && cmSystem.readOnlyAccount.login.password) {
    if (!setData.system.login) {
      setData.system.login = { user: {} };
    }
    setData.system.login.user[cmSystem.readOnlyAccount.login.username] = {
      level: 'operator',
      authentication: {
        'plaintext-password': cmSystem.readOnlyAccount.login.password,
      },
    };
  } else if (cmSystem.readOnlyAccount && !cmSystem.readOnlyAccount.enabled &&
    cmSystem.readOnlyAccount.login && cmSystem.readOnlyAccount.login.username) {
    if (!deleteData.system) {
      deleteData.system = {};
    }
    if (!deleteData.system.login) {
      deleteData.system.login = { user: {} };
    }
    deleteData.system.login.user[cmSystem.readOnlyAccount.login.username] = "''";
  }

  // gateway.
  if (cmSystem.gateway) {
    setData.system['gateway-address'] = cmSystem.gateway;
  }

  // dns.
  if (!deleteData.system) {
    deleteData.system = {};
  }
  deleteData.system['name-server'] = "''";
  if (cmSystem.dns1 || cmSystem.dns2) {
    setData.system['name-server'] = [];
    if (cmSystem.dns1) {
      setData.system['name-server'].push(cmSystem.dns1);
    }
    if (cmSystem.dns2) {
      setData.system['name-server'].push(cmSystem.dns2);
    }
  }

  if (isNull(cmSystem.domainName)) {
    deleteData.system['domain-name'] = "''";
  } else {
    setData.system['domain-name'] = cmSystem.domainName;
  }

  return this.connection.rpc(setConfigRequest(setData, deleteData))
    .mapTo(cmSystem)
    .map(assocPath(['timezoneList'], timezones)); // HACK
}

module.exports = constant(setSystem);
