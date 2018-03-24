'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const { createDeleteRouteQuery } = require('./utils');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @this CommDevice
 * @param {CorrespondenceRoute} correspondenceRoute
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function deleteRoute(correspondenceRoute) {
  return this.getRoutes()
    .mergeMap((correspondenceRoutes) => {
      const deleteData = assocPath(
        createDeleteRouteQuery(correspondenceRoute, correspondenceRoutes),
        "''",
        {}
      );

      return this.connection.rpc(setConfigRequest(null, deleteData));
    });
}

module.exports = constant(deleteRoute);

