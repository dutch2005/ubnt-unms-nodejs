'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');

require('../../util/observable');
const { upgradeFirmwareIfNeeded } = require('./generic');
const log = require('../../logging');
const { firmwaresWsUrl } = require('../../settings');
const ssh = require('../protocol/ssh');
const { DiscoveryConnectProgressEnum } = require('../../enums');
const { toMs } = require('../../util');

const CONNECTION_STRING_TIMEOUT = toMs('second', 30);
const FIRMWARE_UPGRADE_TIMEOUT = toMs('minute', 10);

const RECONNECT_DELAY = toMs('second', 5);

const CONNECTION_TEST_CMD = 'exit 0';

// sudo /usr/bin/ubnt-upgrade --delete-noprompt is intentionally called twice, fixes issue when fw is not really removed
const upgradeFirmwareScript = firmwareUrl => `#!/bin/sh

trap "rm -- \\"$0\\"" EXIT

sudo /usr/bin/ubnt-upgrade --delete-noprompt
sudo /usr/bin/ubnt-upgrade --delete-noprompt
sudo /usr/bin/ubnt-upgrade --upgrade-noprompt "${firmwareUrl}" || exit 1

sudo /opt/vyatta/bin/sudo-users/vyatta-reboot.pl --action reboot --now
`;

const setConnectionStringScript = connectionString => `#!/bin/sh

trap "rm -- \\"$0\\"" EXIT

source /opt/vyatta/etc/functions/script-template

configure
delete service unms disable
set service unms connection ${connectionString}
commit
save
exit
`;

const connectDevice = connectionString => reader(
  config => ssh.runScript(setConnectionStringScript(connectionString), config)
    .timeoutWith(CONNECTION_STRING_TIMEOUT, Observable.throw(new Error('Setting UNMS key timeout')))
);

const tryReconnect = prevConnection => ssh.createConnection(prevConnection.config)
  .switchMap(ssh.runCommand({ command: CONNECTION_TEST_CMD }))  // test new connection
  .retryWhen(errors => errors.delay(RECONNECT_DELAY)); // retry with delay

const onFirmwareUpgradeFail = (err) => {
  log.error('Discovery: Firmware upgrade', err);
  return Observable.throw(new Error('Firmware upgrade has failed'));
};

const upgradeFirmware = firmware => reader(
  config => ssh.runScript(upgradeFirmwareScript(`${firmwaresWsUrl()}${firmware.secureUrl}`), config)
    .mergeMap(ssh.waitForConnectionClose)
    .delay(RECONNECT_DELAY)
    .switchMap(tryReconnect)
    .catch(onFirmwareUpgradeFail)
    .timeoutWith(FIRMWARE_UPGRADE_TIMEOUT, Observable.throw(new Error('Firmware upgrade timeout')))
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @param {AuthCredentials} authCredentials
 * @return {Reader.<connect~callback>}
 */
const connect = (cmDiscoveryDevice, authCredentials) => reader(
  /**
   * @function connect~callback
   * @param {DiscoveryStatusUpdater} statusUpdater
   * @param {FirmwareDal} firmwareDal
   * @param {Function} connectionStringProvider
   * @return {Observable<Object>}
   */
  ({ statusUpdater, firmwareDal, connectionStringProvider }) => {
    const { ip: host } = cmDiscoveryDevice;
    const { username, password, sshPort: port } = authCredentials;

    const connectDeviceReader = connectDevice(connectionStringProvider());
    const upgradeFirmwareIfNeededReader = upgradeFirmwareIfNeeded(upgradeFirmware, cmDiscoveryDevice);

    return ssh.createConnection({ username, password, port, host })
      .mergeMap(connection => upgradeFirmwareIfNeededReader.run({ connection, firmwareDal, statusUpdater }))
      .tapO(() => statusUpdater
        .updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.SettingConnectionString))
      .mergeMap(connection => connectDeviceReader.run(connection))
      .map(ssh.closeConnection);
  }
);

module.exports = { connect };
