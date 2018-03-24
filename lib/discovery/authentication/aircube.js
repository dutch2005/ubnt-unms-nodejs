'use strict';

const { Observable } = require('rxjs/Rx');
const { constant, identity } = require('lodash/fp');
const { chain, pipeP } = require('ramda');
const { Either } = require('monet');
const { cata } = require('ramda-adjunct');

const ubus = require('../protocol/ubus');
const { mergeRight } = require('../../transformers');
const { fromInfoCommand } = require('../../transformers/discovery/device/aircube');
const { mergeAirCubeInfo } = require('../../transformers/discovery/device/aircube/mergers');

/**
 * @param {Object} connection
 * @return {Promise.<Ubus>}
 */
const authenticate = connection => connection.login()
  .then(constant(connection));

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @return {Observable.<CorrespondenceDiscoveryDevice>}
 */
const check = (cmDiscoveryDevice, authCredentials) => {
  const { ip: host } = cmDiscoveryDevice;
  const { username, password, httpsPort: port } = authCredentials;

  const checkThunk = pipeP(
    () => authenticate(ubus.createConnection({ host, port, username, password })),
    connection => connection.call('system', 'board', {}),
    fromInfoCommand({ model: cmDiscoveryDevice.model }),
    chain(mergeRight(mergeAirCubeInfo, Either.of(cmDiscoveryDevice))),
    cata(constant(cmDiscoveryDevice), identity)
  );

  return Observable.defer(checkThunk);
};

module.exports = { authenticate, check };
