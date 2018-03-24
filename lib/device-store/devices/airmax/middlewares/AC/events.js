'use strict';

const { Observable } = require('rxjs/Rx');
const { partial } = require('lodash/fp');

const { pingStatsRequest } = require('../../../../backends/ubridge/messages');
const { airViewRequest, deviceStatusRequest } = require('../../../../backends/airos/messages');
const parsers = require('../../transformers/device/AC/parsers');

const parseHwStatus = partial(parsers.parseHwStatus, [{}]);
const parseHwFrequencyBands = partial(parsers.parseHwFrequencyBands, [{}]);
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

  airViewAction() {
    return this.connection.cmd(airViewRequest())
      .pluck('data')
      .map(parseHwFrequencyBands)
      .do(this.notifyDeviceUpdate.bind(this))
      .catch(error => this.connection.handleError(error, true));
  }

  statusAction() {
    return Observable.forkJoin(this.connection.rpc(pingStatsRequest()), this.connection.rpc(deviceStatusRequest()))
      .do(([hwPingStats, hwStatus]) => {
        this.notifyDeviceUpdate(parseHwStatus(hwStatus));
        this.notifyStats(parseHwDeviceStatistics({ hwPingStats, hwStatus }));
      })
      .catch(error => this.connection.handleError(error, true));
  }

  setupPeriodicActions() {
    const airViewAction = this.airViewAction.bind(this);
    const statusAction = this.statusAction.bind(this);

    this.periodicActions.schedule(this.deviceId, airViewAction, 'airMaxCompleteUpdateInterval');
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
