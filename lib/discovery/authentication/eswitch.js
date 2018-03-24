'use strict';

const { Observable } = require('rxjs/Rx');
const { Either } = require('monet');
const { constant, identity } = require('lodash/fp');
const { chain, when, pipeP, pathSatisfies } = require('ramda');
const { cata, isNotEmpty } = require('ramda-adjunct');

const https = require('../protocol/https');
const { rejectP, tapP, toMs } = require('../../util');
const { mergeRight } = require('../../transformers');
const { fromDashboardHtml } = require('../../transformers/discovery/device/eswitch');
const { mergeEswitchDashboard } = require('../../transformers/discovery/device/eswitch/mergers');

const isInvalid = pathSatisfies(isNotEmpty, ['error']);
const LOGIN_TIMEOUT = toMs('seconds', 20);

/**
 * @param {Object} connection
 * @param {number} timeout
 * @return {Promise<Request>}
 */
const authenticate = (connection, timeout = LOGIN_TIMEOUT) => {
  const { username, password } = connection.credentials;

  return pipeP(
    () => connection.get('/'),
    () => connection.post('/htdocs/login/login.lua', {
      timeout,
      json: true,
      formData: {
        username,
        password,
      },
    }),
    when(isInvalid, () => rejectP(new Error('Invalid credentials'))),
    constant(connection)
  )();
};

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @return {Observable.<CorrespondenceDiscoveryDevice>}
 */
const check = (cmDiscoveryDevice, authCredentials) => {
  const { ip: host } = cmDiscoveryDevice;
  const { username, password, httpsPort: port } = authCredentials;

  const checkThunk = pipeP(
    () => authenticate(https.createConnection({ host, port, username, password })),
    connection => connection.get('/htdocs/pages/base/dashboard.lsp')
      // logout because number of sessions is limited
      .then(tapP(() => connection.get('/htdocs/pages/main/logout.lsp'))),
    fromDashboardHtml({}),
    chain(mergeRight(mergeEswitchDashboard, Either.of(cmDiscoveryDevice))),
    cata(constant(cmDiscoveryDevice), identity)
  );

  return Observable.defer(checkThunk);
};

module.exports = { check, authenticate };
