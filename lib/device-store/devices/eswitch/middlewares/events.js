'use strict';

const { Observable } = require('rxjs/Rx');
const { partial } = require('lodash/fp');

const { MessageNameEnum } = require('../enums');
const { subscribeEventsRequest } = require('../messages');
const parsers = require('../transformers/device/parsers');

const parseHwSystemStats = partial(parsers.parseHwSystemStats, [{}]);
const parseHwDeviceStatistics = partial(parsers.parseHwDeviceStatistics, [{}]);

class EswitchEventsMiddleware {
  constructor(messageHub, cmDevice, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.commDevice = commDevice;
    this.cmDevice = cmDevice;
    this.messageHub = messageHub;

    this.connection = null;
  }

  notifyDeviceUpdate(cmDeviceUpdate) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.eswitchUpdateEvent(this.deviceId, cmDeviceUpdate));
  }

  notifyStats(cmStats) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.eswitchStatisticsEvent(this.deviceId, cmStats));
  }

  handleConfigChangeMessage(message) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.eswitchConfigChangeEvent(this.deviceId, message));

    this.commDevice.buildDevice()
      .do(this.notifyDeviceUpdate.bind(this))
      .takeUntil(this.connection.close$)
      .catch(error => this.connection.handleError(error, true))
      .subscribe();
  }

  handleSystemStats(message) {
    Observable.of(message)
      .pluck('data')
      .do((hwSystemStats) => {
        this.notifyDeviceUpdate(parseHwSystemStats(hwSystemStats));
        this.notifyStats(parseHwDeviceStatistics(hwSystemStats));
      })
      .catch(error => this.connection.handleError(error, true))
      .subscribe();
  }

  handleIncoming(message) {
    switch (message.name) {
      case MessageNameEnum.SystemStats:
        this.handleSystemStats(message);
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
      this.messageHub.publishAndConfirm(messages.eswitchRegisterEvent(this.cmDevice)),
      connection.send(subscribeEventsRequest())
    )
      .finally(() => { this.cmDevice = null }); // free memory
  }

  handleClose() {
    const messages = this.messageHub.messages;

    this.messageHub.publish(messages.eswitchCloseEvent(this.deviceId));
  }
}

const createMiddleware = ({ messageHub, cmEswitch, commDevice }) =>
  new EswitchEventsMiddleware(messageHub, cmEswitch, commDevice);

module.exports = createMiddleware;
