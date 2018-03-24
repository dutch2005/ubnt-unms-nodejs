'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const { createCRUDRouteQuery } = require('./utils');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceRoute} correspondenceRoute
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function blockRoute(correspondenceRoute) {
  const setData = assocPath(
    createCRUDRouteQuery(correspondenceRoute),
    { disable: "''" },
    {}
  );

  return this.connection.rpc(setConfigRequest(setData, null));
}

module.exports = constant(blockRoute);

