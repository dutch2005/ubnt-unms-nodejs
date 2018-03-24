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
function unblockRoute(correspondenceRoute) {
  const deleteData = assocPath(
    createCRUDRouteQuery(correspondenceRoute),
    { disable: "''" },
    {}
  );

  return this.connection.rpc(setConfigRequest(null, deleteData));
}

module.exports = constant(unblockRoute);

