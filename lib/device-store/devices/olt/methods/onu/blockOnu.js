'use strict';

const { constant } = require('lodash/fp');

const { setOnuConfigRequest } = require('../../messages');

/**
 * Blocks ONU o OLT.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceDevice} cmOnu
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function blockOnu(cmOnu) {
  const { identification: { name, serialNumber }, onu: { profile, wanAddress } } = cmOnu;

  const setData = {
    'onu-list': {
      [serialNumber]: {
        name,
        profile,
        'wan-address': wanAddress,
        disable: 'true',
      },
    },
  };

  return this.connection.rpc(setOnuConfigRequest(setData, null));
}

module.exports = constant(blockOnu);

