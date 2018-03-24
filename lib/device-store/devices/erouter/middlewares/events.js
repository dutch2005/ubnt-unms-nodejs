'use strict';

const { Observable } = require('rxjs/Rx');
const { assocPath } = require('ramda');

const { MessageNameEnum } = require('../../../backends/vyatta/enums');
const { deviceConfigRequest } = require('../../../backends/vyatta/messages');
const { parseHwDevice, parseCmRoutes } = require('../../../backends/vyatta/transformers/device/parsers');
const { subscribeEventsRequest } = require('../messages');
const { mergeDeviceUpdate } = require('../../../../transformers/device/mergers');

class ErouterEventsMiddleware {
  constructor(messageHub, cmDevice, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.commDevice = commDevice;
    this.cmDevice = cmDevice;
    this.messageHub = messageHub;

    this.interfacesReceived = false;

    this.connection = null;
  }

  notifyDeviceUpdate(cmDeviceUpdate) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.erouterUpdateEvent(this.deviceId, cmDeviceUpdate));
  }

  handleConfigChangeMessage(message) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.erouterConfigChangeEvent(this.deviceId, message));

    const deviceConfig$ = this.connection.rpc(deviceConfigRequest());
    const routes$ = this.commDevice.getRoutes();

    Observable.forkJoin(deviceConfig$, routes$)
      .map(([hwDeviceConfig, cmRoutes]) => mergeDeviceUpdate(
        parseHwDevice({ features: this.commDevice.features }, hwDeviceConfig),
        parseCmRoutes({}, cmRoutes) // get gateway
      ))
      .do(this.notifyDeviceUpdate.bind(this))
      .takeUntil(this.connection.close$)
      .catch(error => this.connection.handleError(error, true))
      .subscribe();
  }

  handleIncoming(message) {
    const messages = this.messageHub.messages;
    switch (message.name) {
      case MessageNameEnum.Interfaces:
        this.messageHub.publish(messages.erouterInterfacesEvent(
          this.deviceId,
          assocPath(['data', 'shouldLog'], this.interfacesReceived, message)
        ));
        this.interfacesReceived = true;
        break;
      case MessageNameEnum.SystemStats:
        this.messageHub.publish(messages.erouterSystemEvent(this.deviceId, message));
        break;
      case MessageNameEnum.ConfigChange:
        this.handleConfigChangeMessage(message);
        break;
      default:
      // do nothing
    }

    return message;
  }

  handleEstablish(connection) {
    const messages = this.messageHub.messages;
    this.connection = connection;

    return Observable.concat(
      this.messageHub.publishAndConfirm(messages.erouterRegisterEvent(this.cmDevice)),
      connection.send(subscribeEventsRequest())
    )
      .finally(() => { this.cmDevice = null }); // free memory
  }

  handleClose() {
    const messages = this.messageHub.messages;

    this.messageHub.publish(messages.erouterCloseEvent(this.deviceId));
  }
}

const createMiddleware = ({ messageHub, cmErouter, commDevice }) =>
  new ErouterEventsMiddleware(messageHub, cmErouter, commDevice);

module.exports = createMiddleware;
