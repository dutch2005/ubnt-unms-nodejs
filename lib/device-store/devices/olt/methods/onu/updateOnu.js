'use strict';

const { constant } = require('lodash/fp');

const { setOnuConfigRequest } = require('../../messages');

/**
 * Unblocks ONU o OLT.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} cmOnu
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function updateOnu(cmOnu) {
  const { identification: { name, serialNumber }, onu: { profile, wanAddress }, enabled } = cmOnu;

  const setData = {
    'onu-list': {
      [serialNumber]: {
        name,
        profile,
        'wan-address': wanAddress,
        disable: enabled ? 'false' : 'true',
      },
    },
  };

  return this.connection.rpc(setOnuConfigRequest(setData, null));
}

module.exports = constant(updateOnu);

