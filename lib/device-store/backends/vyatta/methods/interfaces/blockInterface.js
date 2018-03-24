'use strict';

const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../messages');
const { interfaceNameToHwProps, isVlanInterfaceType } = require('../../../../../transformers/interfaces/utils');

/**
 * Blocks interface on device.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} interfaceName
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function blockInterface(interfaceName) {
  const hwProps = interfaceNameToHwProps(interfaceName);

  const setData = isVlanInterfaceType(interfaceName)
    ? assocPath(['interfaces', hwProps.section, hwProps.physicalPort, 'vif', hwProps.vlanId, 'disable'], "''", {})
    : assocPath(['interfaces', hwProps.section, interfaceName, 'disable'], "''", {});

  return this.connection.rpc(setConfigRequest(setData, null));
}

module.exports = constant(blockInterface);

