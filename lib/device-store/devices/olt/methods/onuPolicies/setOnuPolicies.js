'use strict';

const { constant } = require('lodash/fp');

const { setOnuConfigRequest } = require('../../messages');

/**
 * Blocks ONU o OLT.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceOnuPolicies} cmOnuPolicies
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function setOnuPolicies(cmOnuPolicies) {
  const setData = {
    'onu-policies': {
      'default-state': cmOnuPolicies.defaultState,
    },
  };

  return this.connection.rpc(setOnuConfigRequest(setData, null));
}

module.exports = constant(setOnuPolicies);

