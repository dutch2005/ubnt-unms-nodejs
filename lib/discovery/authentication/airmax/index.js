'use strict';

const semver = require('semver');
const { pipe, prop, defaultTo, toLower, replace, curry } = require('ramda');

const AcLegacy = require('./airmax-legacy');
const Ac$8d5d0 = require('./airmax-8.5.0');

const check = curry((cmDiscoveryDevice, authCredentials) => {
  const fwVersion = pipe(
    prop('firmwareVersion'),
    defaultTo('0.0.0'),
    toLower,
    replace(/(-cs)?(-aov)?$/ig, '')
  )(cmDiscoveryDevice);

  if (semver.lt(fwVersion, '8.4.999')) {
    return AcLegacy.check(cmDiscoveryDevice, authCredentials);
  }

  return Ac$8d5d0.check(cmDiscoveryDevice, authCredentials);
});

const authenticate = curry((cmDiscoveryDevice, connection) => {
  const fwVersion = pipe(
    prop('firmwareVersion'),
    defaultTo('0.0.0'),
    toLower,
    replace(/(-cs)?(-aov)?$/ig, '')
  )(cmDiscoveryDevice);

  if (semver.gt(fwVersion, '8.4.999')) {
    return Ac$8d5d0.authenticate(connection);
  }

  return AcLegacy.authenticate(connection);
});

module.exports = { check, authenticate };
