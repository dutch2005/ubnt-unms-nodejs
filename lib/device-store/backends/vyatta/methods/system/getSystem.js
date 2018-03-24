'use strict';

const { constant } = require('lodash/fp');

const { systemRequest } = require('../../messages');

const { parseHwSystem } = require('../../transformers/system/parsers');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getSystem() {
  return this.connection.rpc(systemRequest())
    .map(parseHwSystem);
}

module.exports = constant(getSystem);
