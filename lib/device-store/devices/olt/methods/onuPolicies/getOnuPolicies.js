'use strict';

const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwOnuPolicies } = require('../../../../../transformers/device/olt');

const onuPoliciesRequest = partial(rpcRequest, [{
  GET_ONUCFG: { 'onu-policies': null },
}, 'getOnuPolicies']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getOnuPolicies() {
  return this.connection.rpc(onuPoliciesRequest())
    .map(pathOr(null, ['data', 'GET_ONUCFG', 'onu-policies']))
    .mergeEither(fromHwOnuPolicies);
}

module.exports = constant(getOnuPolicies);

