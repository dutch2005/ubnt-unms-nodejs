'use strict';

const { evolve } = require('ramda');
const { isPlainObject, map, flow, mapValues, keyBy, merge, toInteger, getOr } = require('lodash/fp');

const { interfacesStatsRequest } = require('../../../../backends/airos/messages');
const { MessageNameEnum } = require('../../../../backends/airos/enums');

const parseInterfaceStats = flow(
  keyBy('ifname'),
  mapValues(iface => ({
    status: {
      rx_bytes: toInteger(iface.stats.rx_bytes),
      tx_bytes: toInteger(iface.stats.tx_bytes),
    },
  }))
);

class AirMaxInterfaceStatsMiddleware {
  constructor(periodicActions, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.periodicActions = periodicActions;

    // checking config
    this.lastInterfaceStats = {};
  }

  handleStatusMessage(message) {
    return evolve({
      data: {
        interfaces: map((iface) => {
          if (isPlainObject(this.lastInterfaceStats[iface.ifname])) {
            return merge(iface, this.lastInterfaceStats[iface.ifname]);
          }

          return iface;
        }),
      },
    }, message);
  }

  handleInterfaceStats(message) {
    if (isPlainObject(message.data)) {
      this.lastInterfaceStats = parseInterfaceStats(getOr([], 'interfaces', message.data));
    }
  }

  interfaceStatsAction() {
    return this.connection.cmd(interfacesStatsRequest())
      .do(this.handleInterfaceStats.bind(this))
      .catch(error => this.connection.handleError(error, true));
  }

  handleIncoming(message) {
    switch (message.name) {
      case MessageNameEnum.Status:
        return this.handleStatusMessage(message);
      default:
      // do nothing
    }

    return message;
  }

  handleEstablish(connection) {
    this.connection = connection;

    const interfaceStatsAction = this.interfaceStatsAction.bind(this);
    this.periodicActions.schedule(this.deviceId, interfaceStatsAction, 'airMaxUpdateInterval');
  }

  handleClose() {
    this.periodicActions.stop(this.deviceId);
  }
}

const createMiddleware = ({ periodicActions, commDevice }) =>
  new AirMaxInterfaceStatsMiddleware(periodicActions, commDevice);

module.exports = createMiddleware;
