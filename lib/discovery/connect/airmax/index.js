'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader } = require('monet');

const { isACSeries, isMSeries } = require('../../../feature-detection/airmax');

const connectM = require('./M');
const connectAC = require('./AC');

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @return {Reader.<connect~callback>}
 */
const connect = (cmDiscoveryDevice, authCredentials) => {
  if (isMSeries(cmDiscoveryDevice.model)) {
    return connectM(cmDiscoveryDevice, authCredentials);
  } else if (isACSeries(cmDiscoveryDevice.model)) {
    return connectAC(cmDiscoveryDevice, authCredentials);
  }

  return Reader.of(Observable.throw(new Error('Unknown AirMax device')));
};

module.exports = { connect };
