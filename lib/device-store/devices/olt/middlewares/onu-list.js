'use strict';

const { Observable } = require('rxjs/Rx');
const { partial, getOr, zipObject } = require('lodash/fp');

const { rpcRequest } = require('../../../backends/ubridge/messages');

const onuListRequest = partial(rpcRequest, [{ GETDATA: 'gpon_onu_list' }, 'getOnuList']);
const onuConfigRequest = partial(rpcRequest, [{ GET_ONUCFG: { 'onu-list': null } }, 'getOnuConfig']);

class OnuListMiddleware {
  constructor(deviceId, messageHub, periodicActions) {
    this.deviceId = deviceId;
    this.messageHub = messageHub;
    this.periodicActions = periodicActions;
    this.connection = null;
  }

  onuListWithConfigAction() {
    const messages = this.messageHub.messages;

    return Observable.forkJoin(
      this.connection.rpc(onuListRequest()).map(getOr([], ['data', 'output'])),
      this.connection.rpc(onuConfigRequest()).pluck('data')
    )
      .map(zipObject(['onuList', 'onuConfig']))
      .do(message => this.messageHub.publish(messages.oltOnuListEvent(this.deviceId, message)))
      .catch(error => this.connection.handleError(error, true));
  }

  handleEstablish(connection) {
    this.connection = connection;
    const onuListWithConfigAction = this.onuListWithConfigAction.bind(this);

    this.periodicActions.schedule(this.deviceId, onuListWithConfigAction, 'socketRPCPGetOnuListInterval');
  }

  handleClose() {
    this.periodicActions.stop(this.deviceId);
  }
}

const createMiddleware = ({ periodicActions, messageHub, commDevice }) =>
  new OnuListMiddleware(commDevice.deviceId, messageHub, periodicActions);

module.exports = createMiddleware;
