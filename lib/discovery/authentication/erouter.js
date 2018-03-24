'use strict';

const { ReplaySubject } = require('rxjs/Rx');
const { Either } = require('monet');
const { constant, identity } = require('lodash/fp');
const { concat } = require('ramda');
const { cata } = require('ramda-adjunct');

const ssh = require('../protocol/ssh');
const { mergeRight } = require('../../transformers');
const { fromInfoCommand } = require('../../transformers/discovery/device/erouter');
const { mergeErouterInfo } = require('../../transformers/discovery/device/erouter/mergers');

const DEVICE_INFO_CMD = '/bin/hostname && cat /etc/version || exit 0';

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @return {Observable.<CorrespondenceDiscoveryDevice>}
 */
const check = (cmDiscoveryDevice, authCredentials) => {
  const { ip: host } = cmDiscoveryDevice;
  const { username, password, sshPort: port } = authCredentials;

  return ssh.createConnection({ username, password, port, host })
    .switchMap((connection) => {
      const stdout = new ReplaySubject();
      const deviceInfo$ = stdout
        .reduce(concat, '')
        .map(fromInfoCommand({ model: cmDiscoveryDevice.model }));

      return ssh.runCommand({ command: DEVICE_INFO_CMD, stdout }, connection)
        .mergeMap(ssh.waitForConnectionClose)
        .mergeMapTo(deviceInfo$)
        .map(mergeRight(mergeErouterInfo, Either.of(cmDiscoveryDevice)))
        .map(cata(constant(cmDiscoveryDevice), identity));
    });
};


module.exports = { check };
