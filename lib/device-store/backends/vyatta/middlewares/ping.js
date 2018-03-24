'use strict';

const { Observable } = require('rxjs/Rx');
const { pingRequest } = require('../messages');

const MAX_PING_FAILURES = 2;
const PING_TIMEOUT = 1500;

class PingMiddleware {
  constructor(deviceId, periodicActions) {
    this.deviceId = deviceId;
    this.periodicActions = periodicActions;

    this.connection = null;
    this.failures = 0;
  }

  resetFailures() {
    this.failures = 0;
  }

  handlePingFailure() {
    this.failures += 1;
    this.connection.log(`Ping fail ${this.failures}`);
    if (this.failures >= MAX_PING_FAILURES) {
      return this.connection.close();
    }

    return Observable.empty();
  }

  pingAction() {
    return this.connection.rpc(pingRequest(), PING_TIMEOUT)
      .do(this.resetFailures.bind(this))
      .catch(this.handlePingFailure.bind(this));
  }

  handleEstablish(connection) {
    this.connection = connection;
    const pingAction = this.pingAction.bind(this);

    this.periodicActions.schedule(this.deviceId, pingAction, 'socketRPCPingInterval');
  }

  handleClose() {
    this.periodicActions.stop(this.deviceId);
  }
}

const createMiddleware = ({ periodicActions, commDevice }) => new PingMiddleware(commDevice.deviceId, periodicActions);

module.exports = createMiddleware;
