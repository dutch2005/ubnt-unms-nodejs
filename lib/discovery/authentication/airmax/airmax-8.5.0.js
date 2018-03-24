'use strict';

const { Observable } = require('rxjs/Rx');
const { Either } = require('monet');
const qs = require('querystring');
const { constant, identity } = require('lodash/fp');
const { chain, pipeP } = require('ramda');
const { cata } = require('ramda-adjunct');

const https = require('../../protocol/https');
const { rejectP } = require('../../../util');
const { mergeRight } = require('../../../transformers');
const { fromInfoCommand } = require('../../../transformers/discovery/device/airmax');
const { mergeAirMaxInfo } = require('../../../transformers/discovery/device/airmax/mergers');

/**
 * @param {Object} connection
 * @return {Promise<Request>}
 */
const authenticate = (connection) => {
  const { username, password } = connection.credentials;

  return pipeP(
    () => connection.get('/'),
    () => connection.post('/api/auth', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: qs.stringify({
        username,
        password,
      }),
      resolveWithFullResponse: true, // need to get csrf header
    }).catch(() => rejectP(new Error('Invalid credentials'))),
    // eslint-disable-next-line no-param-reassign
    (res) => { connection.headers = { 'x-csrf-id': res.headers['x-csrf-id'] } },
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
    connection => connection.get('/status.cgi', { json: true, headers: connection.headers }),
    fromInfoCommand({ model: cmDiscoveryDevice.model }),
    chain(mergeRight(mergeAirMaxInfo, Either.of(cmDiscoveryDevice))),
    cata(constant(cmDiscoveryDevice), identity)
  );

  return Observable.defer(checkThunk);
};

module.exports = { check, authenticate };
