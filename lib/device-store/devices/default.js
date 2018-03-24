'use strict';

const { Observable } = require('rxjs/Rx');
const { ifElse, pathEq, unary } = require('ramda');
const randomstring = require('randomstring');
const shellEscape = require('shell-escape');

const { modelFeatures } = require('../../feature-detection/common');
const { commandRequest } = require('../backends/ubridge/messages');
const { CommandError } = require('../errors');

const KNOW_METHODS = new Set([
  'buildDevice',
  'restartDevice',
  'setSetup',
  'getStations',
  'createBackup',
  'applyBackup',
  'blockDHCPServer',
  'deleteDHCPServer',
  'getDHCPLeases',
  'getDHCPServers',
  'unblockDHCPServer',
  'upsertDHCPServer',
  'blockInterface',
  'getInterfaces',
  'resetInterfaceStats',
  'unblockInterface',
  'createPPPoEInterface',
  'createVlanInterface',
  'deleteInterface',
  'updateInterface',
  'blockOnu',
  'getOnuConfigList',
  'getOnuList',
  'restartOnu',
  'unblockOnu',
  'updateOnu',
  'upgradeOnu',
  'deleteOspfArea',
  'getOspfAreas',
  'getOspfConfig',
  'setOspfConfig',
  'upsertOspfArea',
  'blockRoute',
  'getRoutes',
  'createRoute',
  'deleteRoute',
  'unblockRoute',
  'updateRoute',
  'getServices',
  'setServices',
  'getSystem',
  'setSystem',
  'getOnuPolicies',
  'setOnuPolicies',
  'createOnuProfile',
  'deleteOnuProfile',
  'getOnuProfiles',
  'updateOnuProfile',
  'runCommand',
  'execScript',
]);

class CommDevice {
  /**
   * @param {String} deviceId
   * @param {DeviceFeatures} features
   * @param {WebSocketConnection} connection
   */
  constructor(deviceId, features, connection) {
    /** @member {WebSocketConnection} */
    this.connection = connection;
    /** @member {String} */
    this.deviceId = deviceId;
    /** @member {DeviceFeatures} */
    this.features = features;
  }

  supports(method) {
    // using 'in' because of Proxy in ./bootstrap.js
    return (method in this && this[method] !== null) && KNOW_METHODS.has(method);
  }

  execScript(script) {
    const scriptFilename = `/tmp/${randomstring.generate({ length: 16 })}`;
    const stdoutFilename = `${scriptFilename}.log`;

    return this.runCommand(`${shellEscape(['echo', script])} > ${scriptFilename}`)
      .mergeMap(() => this.runCommand(`sh ${scriptFilename} > ${stdoutFilename} 2>&1 &`))
      .mapTo(stdoutFilename);
  }

  /**
   * Don't use!
   *
   * @deprecated
   * @param {string} command
   * @return {Observable.<CorrespondenceIncomingMessage>}
   */
  runCommand(command) {
    return this.connection.cmd(commandRequest(command))
      .mergeMap(unary(ifElse(
        pathEq(['data', 'return'], 0),
        Observable.of,
        result => Observable.throw(new CommandError(result))
      )));
  }
}

CommDevice.prototype.KNOWN_METHODS = KNOW_METHODS;

const createDefaultCommDevice = (sysInfo, connection) => {
  const features = modelFeatures(sysInfo.model);
  return new CommDevice(sysInfo.deviceId, features, connection);
};

module.exports = createDefaultCommDevice;
