'use strict';

const { Observable } = require('rxjs/Rx');
const semver = require('semver');
const { Reader: reader } = require('monet');
const { pipe, prop, defaultTo, toLower, replace } = require('ramda');

const AcLegacy = require('./AC-legacy');
const Ac$8d5d0 = require('./AC-8.5.0');

const connect = (cmDiscoveryDevice, authCredentials) => reader(
  (config) => {
    const fwVersion = pipe(
      prop('firmwareVersion'),
      defaultTo('0.0.0'),
      toLower,
      replace(/(-cs)?(-aov)?$/ig, '')
    )(cmDiscoveryDevice);

    if (semver.gt(fwVersion, '8.4.999')) {
      return Ac$8d5d0(cmDiscoveryDevice, authCredentials).run(config);
    }

    return AcLegacy(cmDiscoveryDevice, authCredentials).run(config)
      .catch((error) => {
        // this is a hack to handle firmware connection method change.
        if (error instanceof AcLegacy.SwitchFlowException) {
          return Ac$8d5d0(cmDiscoveryDevice, authCredentials, true).run(config);
        }

        return Observable.throw(error);
      });
  }
);

module.exports = connect;
