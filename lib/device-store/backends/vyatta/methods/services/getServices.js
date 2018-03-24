'use strict';

const { constant } = require('lodash/fp');

const { servicesRequest } = require('../../messages');

const { parseHwServices } = require('../../transformers/services/parsers');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function getServices() {
  return this.connection.rpc(servicesRequest())
    .map(parseHwServices);
}

module.exports = constant(getServices);
