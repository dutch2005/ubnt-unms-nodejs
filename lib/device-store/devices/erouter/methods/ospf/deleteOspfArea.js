'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} areaId
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function upsertOspfArea(areaId) {
  let configPath = ['protocols', 'ospf', 'area', areaId];

  return this.getOspfAreas()
    .mergeMap((areas) => {
      if (areas.length < 2) {
        configPath = configPath.slice(0, -1);
      }

      const deleteData = assocPath(configPath, "''", {});

      return this.connection.rpc(setConfigRequest(null, deleteData));
    });
}

module.exports = constant(upsertOspfArea);

