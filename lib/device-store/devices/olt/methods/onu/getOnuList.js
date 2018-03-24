'use strict';

const { constant, partial } = require('lodash/fp');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');

const onuListRequest = partial(rpcRequest, [{ GETDATA: 'gpon_onu_list' }, 'getOnuList']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getOnuList() {
  return this.connection.rpc(onuListRequest());
}

module.exports = constant(getOnuList);

