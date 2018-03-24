'use strict';

const { Observable } = require('rxjs/Rx');
const { isString, partial } = require('lodash/fp');

const { configCheckRequest, deviceConfigRequest } = require('../../../backends/airos/messages');
const parsers = require('../transformers/device/parsers');

const parseHwDeviceConfig = partial(parsers.parseHwDeviceConfig, [{}]);

class AirMaxConfigCheckMiddleware {
  constructor(messageHub, periodicActions, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.commDevice = commDevice;
    this.periodicActions = periodicActions;
    this.messageHub = messageHub;

    // checking config
    this.lastConfigHash = null;
  }

  notifyDeviceUpdate(cmDeviceUpdate) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.airMaxUpdateEvent(this.deviceId, cmDeviceUpdate));
  }

  handleConfigCheckMessage(message) {
    const configHash = message.data;
    if (isString(configHash) && this.lastConfigHash !== configHash) {
      if (this.lastConfigHash !== null) {
        this.lastConfigHash = configHash;
        const messages = this.messageHub.messages;

        this.messageHub.publish(messages.airMaxConfigChangeEvent(this.deviceId, message));
        return this.connection.cmd(deviceConfigRequest())
          .map(parseHwDeviceConfig)
          .do(this.notifyDeviceUpdate.bind(this));
      }

      this.lastConfigHash = configHash;
    }

    return Observable.empty();
  }

  checkConfigAction() {
    return this.connection.cmd(configCheckRequest())
      .mergeMap(this.handleConfigCheckMessage.bind(this))
      .catch(error => this.connection.handleError(error, true));
  }

  handleEstablish(connection) {
    this.connection = connection;

    const checkConfigAction = this.checkConfigAction.bind(this);
    this.periodicActions.schedule(this.deviceId, checkConfigAction, 'airMaxUpdateInterval');
  }

  handleClose() {
    this.periodicActions.stop(this.deviceId);
  }
}

const createMiddleware = ({ messageHub, periodicActions, commDevice }) =>
  new AirMaxConfigCheckMiddleware(messageHub, periodicActions, commDevice);

module.exports = createMiddleware;
