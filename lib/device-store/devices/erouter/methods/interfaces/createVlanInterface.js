'use strict';

const { constant, isString } = require('lodash/fp');
const { assocPath, path, pathEq, ifElse } = require('ramda');
const { isNotEmpty } = require('ramda-adjunct');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const { interfaceNameToHwProps } = require('../../../../../transformers/interfaces/utils');
const { IpAddressTypeEnum } = require('../../../../../enums');

/**
 * Creates VLAN interface from payload on device.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {VlanPayload} newVlanInterface
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function createVlanInterface(newVlanInterface) {
  const hwProps = interfaceNameToHwProps(newVlanInterface.interface);
  const vlanPath = ['interfaces', hwProps.section, newVlanInterface.interface, 'vif', newVlanInterface.vlanId];
  let setData = {};

  // mtu hw instruction.
  setData = assocPath([...vlanPath, 'mtu'], String(newVlanInterface.mtu), setData);

  // description hw instruction.
  if (isString(newVlanInterface.description)) {
    setData = assocPath([...vlanPath, 'description'], newVlanInterface.description, setData);
  }

  // address hw instruction.
  if (isNotEmpty(newVlanInterface.addresses)) {
    const addresses = newVlanInterface.addresses.map(ifElse(
      pathEq(['type'], IpAddressTypeEnum.Static),
      path(['cidr']),
      path(['type'])
    ));
    setData = assocPath([...vlanPath, 'address'], addresses, setData);
  }

  return this.connection.rpc(setConfigRequest(setData, null));
}

module.exports = constant(createVlanInterface);

