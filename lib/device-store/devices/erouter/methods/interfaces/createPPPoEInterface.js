'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const { interfaceNameToHwProps } = require('../../../../../transformers/interfaces/utils');

/**
 * CCreates PPPoe interface from payload on device.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {PPPoEPayload} newPPPoEInterface
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function createPPPoEInterface(newPPPoEInterface) {
  const hwProps = interfaceNameToHwProps(newPPPoEInterface.interface);
  const pppoePath = ['interfaces', hwProps.section, newPPPoEInterface.interface, 'pppoe', newPPPoEInterface.pppoeId];
  let setData = {};

  // mtu hw instruction.
  if (Number(newPPPoEInterface.mtu) !== this.features.defaults.pppoeMtu) {
    setData = assocPath([...pppoePath, 'mtu'], String(newPPPoEInterface.mtu), setData);
  }

  // password hw instruction.
  setData = assocPath([...pppoePath, 'password'], newPPPoEInterface.password, setData);

  // account name hw instruction.
  setData = assocPath([...pppoePath, 'user-id'], newPPPoEInterface.account, setData);

  return this.connection.rpc(setConfigRequest(setData, null));
}

module.exports = constant(createPPPoEInterface);

