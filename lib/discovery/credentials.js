'use strict';

const { Reader: reader } = require('monet');
const { isNotUndefined } = require('ramda-adjunct');

/**
 * @typedef {Object} AuthCredentials
 * @property {string} username
 * @property {?string} password
 * @property {?number} httpsPort
 * @property {?number} sshPort
 */

class CredentialsStore {
  constructor() {
    this.credentials = {};
  }

  /**
   * @param {string} userId
   * @param {string} deviceIdOrIp
   * @param {AuthCredentials} credentials
   * @return {void}
   */
  set(userId, deviceIdOrIp, credentials) {
    const store = this.credentials[userId] || (this.credentials[userId] = new Map());
    store.set(deviceIdOrIp, credentials);
  }

  /**
   * @param {string} userId
   * @param {string[]} deviceIdsOrIps
   * @return {?AuthCredentials}
   */
  get(userId, deviceIdsOrIps) {
    const store = this.credentials[userId];

    if (!store) { return null }

    for (const key of deviceIdsOrIps) { // eslint-disable-line no-restricted-syntax
      const credentials = store.get(key);
      if (isNotUndefined(credentials)) { return credentials }
    }

    return null;
  }
}

/**
 * @param {string} userId
 * @param {string} deviceIdOrIp
 * @param {string} username
 * @param {string} password
 * @param {number} httpsPort
 * @param {number} sshPort
 * @return {Reader.<setCredentials~callback>}
 */
const setCredentials = (userId, deviceIdOrIp, { username, password, httpsPort, sshPort }) => reader(
  /**
   * @function setCredentials~callback
   * @param {CredentialsStore} store
   * @return {void}
   */
  (store) => { store.set(userId, deviceIdOrIp, { username, password, httpsPort, sshPort }) }
);

/**
 * @param {string} userId
 * @param {string[]} deviceIdsOrIps
 * @return {Reader.<getCredentials~callback>}
 */
const getCredentials = (userId, deviceIdsOrIps) => reader(
  /**
   * @function getCredentials~callback
   * @param {CredentialsStore} store
   * @return {?AuthCredentials}
   */
  store => store.get(userId, deviceIdsOrIps)
);

module.exports = { CredentialsStore, setCredentials, getCredentials };
