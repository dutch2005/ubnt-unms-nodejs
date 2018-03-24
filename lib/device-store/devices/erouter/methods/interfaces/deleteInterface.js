'use strict';

const { Observable } = require('rxjs/Rx');
const { constant } = require('lodash/fp');
const { assocPath } = require('ramda');

const { InvalidOperationError } = require('../../../../errors');
const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const {
  interfaceNameToHwProps, isVlanInterfaceType, isPPPoEInterfaceType,
} = require('../../../../../transformers/interfaces/utils');

/**
 * Removes interface from device.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} interfaceName
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function deleteInterface(interfaceName) {
  const hwProps = interfaceNameToHwProps(interfaceName);

  let deleteData = null;
  if (isVlanInterfaceType(interfaceName)) {
    deleteData = assocPath(['interfaces', hwProps.section, hwProps.physicalPort, 'vif', hwProps.vlanId], "''", {});
  } else if (isPPPoEInterfaceType) {
    deleteData = assocPath(['interfaces', hwProps.section, hwProps.physicalPort, 'pppoe', hwProps.pppoeId], "''", {});
  }

  return deleteData !== null
    ? this.connection.rpc(setConfigRequest(null, deleteData))
    : Observable.throw(new InvalidOperationError(`Interface ${interfaceName} cannot be removed.`));
}

module.exports = constant(deleteInterface);

