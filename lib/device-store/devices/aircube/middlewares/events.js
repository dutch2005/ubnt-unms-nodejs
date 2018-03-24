'use strict';

const { subscribeEventsRequest } = require('../messages');
const { MessageNameEnum } = require('../../../backends/openwrt/enums');

class AirCubeEventsMiddleware {
  constructor(messageHub, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.commDevice = commDevice;
    this.messageHub = messageHub;
  }

  // eslint-disable-next-line class-methods-use-this
  handleEstablish(connection) {
    return connection.send(subscribeEventsRequest());
  }

  handleIncoming(message) {
    switch (message.name) {
      case MessageNameEnum.ConfigChange:
        this.handleConfigChangeMessage(message);
        break;
      default:
      // do nothing
    }

    return message;
  }

  handleConfigChangeMessage(message) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.airCubeConfigChangeEvent(this.deviceId, message));
  }
}

const createMiddleware = ({ messageHub, commDevice }) =>
  new AirCubeEventsMiddleware(messageHub, commDevice);

module.exports = createMiddleware;
