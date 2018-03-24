'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceOspfArea} newArea
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function upsertOspfArea(newArea) {
  const setData = assocPath(['protocols', 'ospf', 'area', newArea.id], {
    'area-type': { [newArea.type]: "''" },
    authentication: newArea.auth,
    network: newArea.networks,
  }, {});

  const deleteData = assocPath(['protocols', 'ospf', 'area', newArea.id], "''", {});

  return this.connection.rpc(setConfigRequest(setData, deleteData));
}

module.exports = constant(upsertOspfArea);

