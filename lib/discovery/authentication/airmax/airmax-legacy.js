'use strict';

const { Observable } = require('rxjs/Rx');
const { Either } = require('monet');
const { constant, identity, includes } = require('lodash/fp');
const { chain, when, pipeP } = require('ramda');
const { cata } = require('ramda-adjunct');

const https = require('../../protocol/https');
const { rejectP } = require('../../../util');
const { mergeRight } = require('../../../transformers');
const { fromInfoCommand } = require('../../../transformers/discovery/device/airmax');
const { mergeAirMaxInfo } = require('../../../transformers/discovery/device/airmax/mergers');

const isInvalid = includes('id="errmsg"');

/**
 * @param {Object} connection
 * @return {Promise<Request>}
 */
const authenticate = (connection) => {
  const { username, password } = connection.credentials;

  return pipeP(
    () => connection.get('/'),
    () => connection.post('/login.cgi', {
      formData: {
        uri: '',
        username,
        password,
        login: 'Login',
      },
    }),
    // TODO(michal.sedlak@ubnt.com): Handle more errors
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
    connection => connection.get('/status.cgi', { json: true }),
    fromInfoCommand({ model: cmDiscoveryDevice.model }),
    chain(mergeRight(mergeAirMaxInfo, Either.of(cmDiscoveryDevice))),
    cata(constant(cmDiscoveryDevice), identity)
  );

  return Observable.defer(checkThunk);
};

module.exports = { check, authenticate };
