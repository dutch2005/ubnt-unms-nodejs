'use strict';

const { Observable } = require('rxjs/Rx');
const { partial } = require('lodash/fp');

const { pingStatsRequest } = require('../../../../backends/ubridge/messages');
const { stationListRequest, deviceStatusRequest } = require('../../../../backends/airos/messages');
const parsers = require('../../transformers/device/M/parsers');

const parseHwStatus = partial(parsers.parseHwStatus, [{}]);
const parseHwDeviceStatistics = partial(parsers.parseHwDeviceStatistics, [{}]);

class AirMaxEventsMiddleware {
  constructor(messageHub, periodicActions, cmDevice, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.commDevice = commDevice;
    this.cmDevice = cmDevice;
    this.periodicActions = periodicActions;
    this.messageHub = messageHub;
  }

  notifyDeviceUpdate(cmDeviceUpdate) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.airMaxUpdateEvent(this.deviceId, cmDeviceUpdate));
  }

  notifyStats(cmStats) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.airMaxStatisticsEvent(this.deviceId, cmStats));
  }

  statusAction() {
    return Observable.forkJoin(
      this.connection.rpc(pingStatsRequest()),
      this.connection.rpc(deviceStatusRequest()),
      this.connection.rpc(stationListRequest()).pluck('data')
    )
      .do(([hwPingStats, hwStatus, hwStationList]) => {
        this.notifyDeviceUpdate(parseHwStatus({ hwStatus, hwStationList }));
        this.notifyStats(parseHwDeviceStatistics({ hwPingStats, hwStatus, hwStationList }));
      })
      .catch(error => this.connection.handleError(error, true));
  }

  setupPeriodicActions() {
    const statusAction = this.statusAction.bind(this);

    this.periodicActions.schedule(this.deviceId, statusAction, 'airMaxUpdateInterval');
  }

  handleEstablish(connection) {
    const messages = this.messageHub.messages;
    this.connection = connection;

    return Observable.defer(() => this.messageHub.publishAndConfirm(messages.airMaxRegisterEvent(this.cmDevice)))
      .do(() => {
        this.cmDevice = null;
        this.setupPeriodicActions();
      });
  }

  handleClose() {
    const messages = this.messageHub.messages;
    const deviceId = this.deviceId;

    this.periodicActions.stop(deviceId);
    this.messageHub.publish(messages.airMaxCloseEvent(deviceId));
  }
}

const createMiddleware = ({ messageHub, periodicActions, cmAirMax, commDevice }) =>
  new AirMaxEventsMiddleware(messageHub, periodicActions, cmAirMax, commDevice);

module.exports = createMiddleware;
