'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const { createCRUDRouteQuery, createRouteMetaObj } = require('./utils');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceRoute} correspondenceRoute
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function updateRoute(correspondenceRoute) {
  const setData = assocPath(
    createCRUDRouteQuery(correspondenceRoute),
    createRouteMetaObj(correspondenceRoute),
    {}
  );

  return this.connection.rpc(setConfigRequest(setData, null));
}

module.exports = constant(updateRoute);

