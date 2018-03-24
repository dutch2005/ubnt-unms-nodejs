'use strict';

const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

require('../../../../../util/observable');
const { MessageNameEnum } = require('../../enums');
const { rpcRequest } = require('../../../ubridge/messages');
const { parseHwInterfaceConfig } = require('../../transformers/interfaces/parsers');

const interfacesRequest = partial(rpcRequest, [{
  GET: {
    interfaces: null,
  },
}, MessageNameEnum.GetInterfaces]);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getInterfaces() {
  return this.connection.rpc(interfacesRequest())
    .map(pathOr(null, ['data', 'interfaces']))
    .map(hwInterfaceConfig => parseHwInterfaceConfig({ features: this.features }, hwInterfaceConfig));
}

module.exports = constant(getInterfaces);

