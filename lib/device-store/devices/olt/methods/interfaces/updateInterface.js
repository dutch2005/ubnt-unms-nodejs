'use strict';

const { Observable } = require('rxjs/Rx');
const { constant } = require('lodash/fp');
const { assocPath, pathSatisfies, pathEq } = require('ramda');
const { isNotUndefined, isNotNull } = require('ramda-adjunct');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const {
  interfaceNameToHwProps, isSfpInterfaceType, isPonInterfaceType, isBridgeInterfaceType,
} = require('../../../../../transformers/interfaces/utils');
const { PonAuthorizationTypeEnum, InterfaceSpeedEnum } = require('../../../../../enums');
const { InvalidOperationError } = require('../../../../errors');

const updateSfpInterface = (interfaceName, updateInstructions) => {
  const hwProps = interfaceNameToHwProps(interfaceName);
  const sfpInterfacePath = ['interfaces', hwProps.section, hwProps.name];
  let setData = {};

  // speed hw instruction.
  if (pathSatisfies(isNotUndefined, ['speed'], updateInstructions)) {
    if (updateInstructions.speed === InterfaceSpeedEnum.Full10G) {
      setData = assocPath([...sfpInterfacePath, 'speed'], '10G', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Full1G) {
      setData = assocPath([...sfpInterfacePath, 'speed'], '1000', setData);
    }
  }

  return { setData, deleteData: null };
};

const updatePonInterface = (interfaceName, updateInstructions) => {
  const hwProps = interfaceNameToHwProps(interfaceName);
  const ponInterfacePath = ['interfaces', hwProps.section, hwProps.name];
  let setData = {};
  let deleteData = {};

  // description hw instruction.
  if (pathSatisfies(isNotUndefined, ['description'], updateInstructions)) {
    if (isNotNull(updateInstructions.description)) {
      setData = assocPath([...ponInterfacePath, 'description'], updateInstructions.description, setData);
    } else {
      deleteData = assocPath([...ponInterfacePath, 'description'], "''", deleteData);
    }
  }

  // pON authentication hw instructions.
  if (pathSatisfies(isNotUndefined, ['pon'], updateInstructions)) {
    const { authorizationType, preSharedSecret } = updateInstructions.pon.authentication;

    if (authorizationType === PonAuthorizationTypeEnum.PSK) {
      setData = assocPath([...ponInterfacePath, 'authentication', 'mode'], 'pre-shared-secret', setData);
      setData = assocPath([...ponInterfacePath, 'authentication', 'pre-shared-secret'], preSharedSecret, setData);
    } else if (authorizationType === PonAuthorizationTypeEnum.NoAuth) {
      setData = assocPath([...ponInterfacePath, 'authentication', 'mode'], 'no-auth', setData);
    }
  }

  return { setData, deleteData };
};

const updateBridgeInterface = (interfaceName, updateInstructions) => {
  const hwProps = interfaceNameToHwProps(interfaceName);
  const bridgeInterfacePath = ['interfaces', hwProps.section, hwProps.name];
  let setData = {};
  let deleteData = {};

  // description hw instruction.
  if (pathSatisfies(isNotUndefined, ['description'], updateInstructions)) {
    if (isNotNull(updateInstructions.description)) {
      setData = assocPath([...bridgeInterfacePath, 'description'], updateInstructions.description, setData);
    } else {
      deleteData = assocPath([...bridgeInterfacePath, 'description'], "''", deleteData);
    }
  }

  // bridge settings hw instructions.
  if (pathSatisfies(isNotUndefined, ['bridge', 'settings'], updateInstructions)) {
    const settings = updateInstructions.bridge.settings;

    setData = assocPath([...bridgeInterfacePath, 'priority'], String(settings.priority), setData);
    setData = assocPath([...bridgeInterfacePath, 'forwarding-delay'], String(settings.forwardingDelay), setData);
    setData = assocPath([...bridgeInterfacePath, 'hello-time'], String(settings.helloTime), setData);
    setData = assocPath([...bridgeInterfacePath, 'max-age'], String(settings.maxAge), setData);

    if (settings.stp) {
      setData = assocPath([...bridgeInterfacePath, 'stp'], true, setData);
    } else {
      deleteData = assocPath([...bridgeInterfacePath, 'stp'], "''", deleteData);
    }
  }

  // bridge ports hw instructions.
  if (pathSatisfies(isNotUndefined, ['bridge', 'ports'], updateInstructions)) {
    setData = updateInstructions.bridge.ports
      .filter(pathEq(['enabled'], true))
      .reduce((accumulator, port) => {
        const portHwProps = interfaceNameToHwProps(port.interface.name);
        const portPath = ['interfaces', portHwProps.section, portHwProps.name, 'bridge-group', 'bridge'];

        return assocPath(portPath, interfaceName, accumulator);
      }, setData);

    deleteData = updateInstructions.bridge.ports
      .filter(pathEq(['enabled'], false))
      .reduce((accumulator, port) => {
        const portHwProps = interfaceNameToHwProps(port.interface.name);
        const portPath = ['interfaces', portHwProps.section, portHwProps.name, 'bridge-group'];

        return assocPath(portPath, "''", accumulator);
      }, deleteData);
  }

  return { setData, deleteData };
};

/**
 * Update device interface.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} interfaceName
 * @param {HwInterfaceInstructionsDescriptor} updateInstructions
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function updateInterface(interfaceName, updateInstructions) {
  let instructions = {};

  if (isSfpInterfaceType(interfaceName)) {
    instructions = updateSfpInterface(interfaceName, updateInstructions);
  } else if (isPonInterfaceType(interfaceName)) {
    instructions = updatePonInterface(interfaceName, updateInstructions);
  } else if (isBridgeInterfaceType(interfaceName)) {
    instructions = updateBridgeInterface(interfaceName, updateInstructions);
  } else {
    return Observable.throw(new InvalidOperationError('Unknown interface type'));
  }

  const { setData, deleteData } = instructions;

  return this.connection.rpc(setConfigRequest(setData, deleteData));
}

module.exports = constant(updateInterface);

