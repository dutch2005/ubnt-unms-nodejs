'use strict';

const { assign, tap, merge, isPlainObject } = require('lodash/fp');
const { pathEq } = require('ramda');
const rp = require('request-promise-native');

const { toMs, rejectP } = require('../../util');

const REQUEST_TIMEOUT = toMs('seconds', 60);
const NULL_SESSION = '00000000000000000000000000000000';

const createInstance = (config = {}) => rp.defaults(assign(config, {
  followAllRedirects: true,
  strictSSL: false,
  json: true,
  timeout: REQUEST_TIMEOUT,
  headers: { 'User-Agent': 'UNMS' },
}));

class Ubus {
  constructor(host, port, username, password) {
    this.credentials = { username, password };

    this.session = NULL_SESSION;
    this.connection = createInstance({
      baseUrl: `https://${host}:${port}`,
    });
  }

  static unwrapResult(response) {
    if (!pathEq(['result', 0], 0, response)) {
      // call failed
      return rejectP(response);
    }

    return response.result[1];
  }

  static buildPayload(method, params, session) {
    return {
      jsonrpc: '2.0',
      method,
      params: [session, ...params],
      id: 0,
    };
  }

  call(...params) {
    return this.connection.post('/ubus', {
      body: Ubus.buildPayload('call', params, this.session),
    }).then(Ubus.unwrapResult);
  }

  poll() {
    return this.connection.post('/ubus', {
      body: Ubus.buildPayload('call', ['session', 'login', {}], NULL_SESSION),
    });
  }

  request(options) {
    return this.connection(merge(options, { headers: { SESSION_ID: this.session } }));
  }

  login() {
    return this.call('session', 'login', this.credentials)
      .catch(response => (isPlainObject(response) ? rejectP(new Error('Invalid credentials')) : rejectP(response)))
      .then(tap((result) => {
        this.session = result.ubus_rpc_session;
      }));
  }

  logout() {
    return this.call('session', 'destroy', {});
  }
}

const createConnection = ({ host, port = 443, username, password }) => new Ubus(host, port, username, password);

module.exports = { createConnection };
