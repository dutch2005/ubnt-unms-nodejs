'use strict';

const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwOnuList } = require('../../../../../transformers/device/olt');

const onuConfigListRequest = partial(rpcRequest, [{
  GET_ONUCFG: { 'onu-list': null },
}, 'getOnuConfigList']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getOnuConfigList() {
  return this.connection.rpc(onuConfigListRequest())
    .map(pathOr(null, ['data', 'GET_ONUCFG', 'onu-list']))
    .mergeEither(fromHwOnuList);
}

module.exports = constant(getOnuConfigList);

