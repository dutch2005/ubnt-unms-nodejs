'use strict';

const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwOnuProfileList } = require('../../../../../transformers/device/olt');

const onuPoliciesRequest = partial(rpcRequest, [{
  GET_ONUCFG: { 'onu-profiles': null },
}, 'getOnuProfiles']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getOnuProfiles() {
  return this.connection.rpc(onuPoliciesRequest())
    .map(pathOr(null, ['data', 'GET_ONUCFG', 'onu-profiles']))
    .mergeEither(fromHwOnuProfileList);
}

module.exports = constant(getOnuProfiles);

