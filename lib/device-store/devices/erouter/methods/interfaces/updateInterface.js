'use strict';

const { constant, defaultTo } = require('lodash/fp');
const { assocPath, pathSatisfies, path, pathEq, ifElse } = require('ramda');
const { isNotUndefined, isNotNull, isNotNil } = require('ramda-adjunct');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');
const {
  interfaceNameToHwProps, isVlanInterfaceType, isPPPoEInterfaceType,
} = require('../../../../../transformers/interfaces/utils');
const { OspfAuthTypeEnum, IpAddressTypeEnum, InterfaceSpeedEnum } = require('../../../../../enums');

/**
 * @param {string} interfaceName
 * @param {Object} updateInstructions
 * @param {DeviceFeatures} features
 * @return {Object}
 */
const updatePPPoEInterface = (interfaceName, updateInstructions, features) => {
  const hwProps = interfaceNameToHwProps(interfaceName);
  const pppoeInterfacePath = ['interfaces', hwProps.section, hwProps.physicalPort];
  if (hwProps.vlanId !== null) { pppoeInterfacePath.push('vif', hwProps.vlanId) }
  pppoeInterfacePath.push('pppoe', hwProps.pppoeId);

  let setData = {};
  let deleteData = {};

  // mtu hw instruction.
  if (pathSatisfies(isNotUndefined, ['mtu'], updateInstructions)) {
    if (updateInstructions.mtu === features.defaults.pppoeMtu) {
      deleteData = assocPath([...pppoeInterfacePath, 'mtu'], "''", deleteData);
    } else {
      setData = assocPath([...pppoeInterfacePath, 'mtu'], String(updateInstructions.mtu), setData);
    }
  }

  // hw instructions for PPPoE
  if (pathSatisfies(isNotUndefined, ['pppoe'], updateInstructions)) {
    setData = assocPath([...pppoeInterfacePath, 'password'], updateInstructions.pppoe.password, setData);
    setData = assocPath([...pppoeInterfacePath, 'user-id'], updateInstructions.pppoe.account, setData);
  }

  // hw instructions for OSPF
  if (pathSatisfies(isNotUndefined, ['ospf'], updateInstructions)) {
    deleteData = assocPath([...pppoeInterfacePath, 'ip', 'ospf'], "''", deleteData);

    const { ospfConfig } = updateInstructions.ospf;

    if (isNotNull(ospfConfig)) {
      if (ospfConfig.cost !== null) {
        setData = assocPath([...pppoeInterfacePath, 'ip', 'ospf'], {
          cost: ospfConfig.cost,
        }, setData);
      }

      if (ospfConfig.auth === OspfAuthTypeEnum.Md5) {
        setData = assocPath(
          [...pppoeInterfacePath, 'ip', 'ospf', 'authentication', 'md5', 'key-id', '1', 'md5-key'],
          ospfConfig.authKey,
          setData
        );
      } else if (ospfConfig.auth === OspfAuthTypeEnum.Plaintext) {
        setData = assocPath(
          [...pppoeInterfacePath, 'ip', 'ospf', 'authentication', 'plaintext-password'],
          ospfConfig.authKey,
          setData
        );
      } else if (ospfConfig.auth === OspfAuthTypeEnum.None && ospfConfig.cost !== null) {
        setData = assocPath([...pppoeInterfacePath, 'ip', 'ospf'], {
          cost: ospfConfig.cost,
        }, setData);
      } else {
        setData = assocPath([...pppoeInterfacePath, 'ip', 'ospf'], "''", setData);
      }
    }
  }

  return { setData, deleteData };
};

/**
 * @param {string} interfaceName
 * @param {Object} updateInstructions
 * @param {DeviceFeatures} features
 * @return {Object}
 */
const updateVlanInterface = (interfaceName, updateInstructions, features) => {
  const hwProps = interfaceNameToHwProps(interfaceName);
  const vlanInterfacePath = ['interfaces', hwProps.section, hwProps.physicalPort, 'vif', hwProps.vlanId];
  let setData = {};
  let deleteData = {};

  // description hw instruction.
  if (pathSatisfies(isNotUndefined, ['description'], updateInstructions)) {
    if (isNotNull(updateInstructions.description)) {
      setData = assocPath([...vlanInterfacePath, 'description'], updateInstructions.description, setData);
    } else {
      deleteData = assocPath([...vlanInterfacePath, 'description'], "''", deleteData);
    }
  }

  // mtu hw instruction.
  if (pathSatisfies(isNotUndefined, ['mtu'], updateInstructions)) {
    if (updateInstructions.mtu === features.defaults.mtu) {
      deleteData = assocPath([...vlanInterfacePath, 'mtu'], "''", deleteData);
    } else {
      setData = assocPath([...vlanInterfacePath, 'mtu'], String(updateInstructions.mtu), setData);
    }
  }

  // proxy ARP hw instruction.
  if (pathSatisfies(isNotUndefined, ['proxyARP'], updateInstructions)) {
    if (updateInstructions.proxyARP) {
      setData = assocPath([...vlanInterfacePath, 'ip', 'enable-proxy-arp'], "''", setData);
    } else {
      deleteData = assocPath([...vlanInterfacePath, 'ip', 'enable-proxy-arp'], "''", deleteData);
    }
  }

  // address hw instructions.
  if (pathSatisfies(isNotUndefined, ['addresses'], updateInstructions)) {
    const address = updateInstructions.addresses.map(ifElse(
      pathEq(['type'], IpAddressTypeEnum.Static),
      path(['cidr']),
      path(['type'])
    ));
    deleteData = assocPath([...vlanInterfacePath, 'address'], "''", deleteData);
    if (address.length > 0) {
      setData = assocPath([...vlanInterfacePath, 'address'], address, setData);
    }
  }

  // hw instructions for OSPF
  if (pathSatisfies(isNotUndefined, ['ospf'], updateInstructions)) {
    deleteData = assocPath([...vlanInterfacePath, 'ip', 'ospf'], "''", deleteData);

    const { ospfConfig } = updateInstructions.ospf;

    if (isNotNull(ospfConfig)) {
      if (ospfConfig.cost !== null) {
        setData = assocPath([...vlanInterfacePath, 'ip', 'ospf'], {
          cost: ospfConfig.cost,
        }, setData);
      }

      if (ospfConfig.auth === OspfAuthTypeEnum.Md5) {
        setData = assocPath(
          [...vlanInterfacePath, 'ip', 'ospf', 'authentication', 'md5', 'key-id', '1', 'md5-key'],
          ospfConfig.authKey,
          setData
        );
      } else if (ospfConfig.auth === OspfAuthTypeEnum.Plaintext) {
        setData = assocPath(
          [...vlanInterfacePath, 'ip', 'ospf', 'authentication', 'plaintext-password'],
          ospfConfig.authKey,
          setData
        );
      } else if (ospfConfig.auth === OspfAuthTypeEnum.None && ospfConfig.cost !== null) {
        setData = assocPath([...vlanInterfacePath, 'ip', 'ospf'], {
          cost: ospfConfig.cost,
        }, setData);
      } else {
        setData = assocPath([...vlanInterfacePath, 'ip', 'ospf'], "''", setData);
      }
    }
  }

  return { setData, deleteData };
};

/**
 * @param {string} interfaceName
 * @param {Object} updateInstructions
 * @param {DeviceFeatures} features
 * @return {Object}
 */
const updatePhysicalInterface = (interfaceName, updateInstructions, features) => {
  const hwProps = interfaceNameToHwProps(interfaceName);
  const physicalInterfacePath = ['interfaces', hwProps.section, hwProps.name];
  let setData = {};
  let deleteData = {};

  // description hw instruction
  if (pathSatisfies(isNotUndefined, ['description'], updateInstructions)) {
    if (isNotNull(updateInstructions.description)) {
      setData = assocPath([...physicalInterfacePath, 'description'], updateInstructions.description, setData);
    } else {
      deleteData = assocPath([...physicalInterfacePath, 'description'], "''", deleteData);
    }
  }

  // speed hw instruction
  if (pathSatisfies(isNotUndefined, ['speed'], updateInstructions)) {
    if (updateInstructions.speed === InterfaceSpeedEnum.Auto) {
      setData = assocPath([...physicalInterfacePath, 'speed'], 'auto', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'auto', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Full100) {
      setData = assocPath([...physicalInterfacePath, 'speed'], '100', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'full', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Half100) {
      setData = assocPath([...physicalInterfacePath, 'speed'], '100', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'half', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Full10) {
      setData = assocPath([...physicalInterfacePath, 'speed'], '10', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'full', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Half10) {
      setData = assocPath([...physicalInterfacePath, 'speed'], '10', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'half', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Full10000) {
      setData = assocPath([...physicalInterfacePath, 'speed'], '10000', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'full', setData);
    } else if (updateInstructions.speed === InterfaceSpeedEnum.Full1000) {
      setData = assocPath([...physicalInterfacePath, 'speed'], '1000', setData);
      setData = assocPath([...physicalInterfacePath, 'duplex'], 'full', setData);
    }
  }

  // mtu hw instruction
  if (pathSatisfies(isNotUndefined, ['mtu'], updateInstructions)) {
    if (updateInstructions.mtu === features.defaults.mtu) {
      deleteData = assocPath([...physicalInterfacePath, 'mtu'], "''", deleteData);
    } else {
      setData = assocPath([...physicalInterfacePath, 'mtu'], String(updateInstructions.mtu), setData);
    }
  }

  // proxy ARP hw instruction
  if (pathSatisfies(isNotUndefined, ['proxyARP'], updateInstructions)) {
    if (updateInstructions.proxyARP) {
      setData = assocPath([...physicalInterfacePath, 'ip', 'enable-proxy-arp'], "''", setData);
    } else {
      deleteData = assocPath([...physicalInterfacePath, 'ip', 'enable-proxy-arp'], "''", deleteData);
    }
  }

  // poe hw instruction
  if (pathSatisfies(isNotUndefined, ['poe'], updateInstructions)) {
    setData = assocPath([...physicalInterfacePath, 'poe', 'output'], updateInstructions.poe.output, setData);
  }

  // address hw instructions
  if (pathSatisfies(isNotUndefined, ['addresses'], updateInstructions)) {
    const address = updateInstructions.addresses.map(ifElse(
      pathEq(['type'], IpAddressTypeEnum.Static),
      path(['cidr']),
      path(['type'])
    ));

    deleteData = assocPath([...physicalInterfacePath, 'address'], "''", deleteData);
    if (address.length > 0) {
      setData = assocPath([...physicalInterfacePath, 'address'], address, setData);
    }
  }

  // switch hw instructions
  if (pathSatisfies(isNotUndefined, ['switch'], updateInstructions)) {
    // hack to allow removing all interfaces from switch
    const hasInterfaces = updateInstructions.switch.ports
      .filter(pathEq(['enabled'], true))
      .length !== 0;

    // vlanEnabled hw instruction.
    if (hasInterfaces && updateInstructions.switch.vlanEnabled) {
      setData = assocPath([...physicalInterfacePath, 'switch-port', 'vlan-aware'], 'enable', setData);
    }


    // ospf instructions
    if (pathSatisfies(isNotNil, ['switch', 'ospf', 'config'], updateInstructions)) {
      // TODO(vladimir.gorej@gmail.com): this needs to be implemented
    }

    // ports hw instructions
    setData = updateInstructions.switch.ports
      .filter(pathEq(['enabled'], true))
      .reduce((accumulator, port) => {
        const portName = path(['interface', 'name'], port);
        const switchPortPath = [...physicalInterfacePath, 'switch-port', 'interface', portName];
        let data = null;

        if (isNotNull(port.pvid)) {
          data = assocPath(['vlan', 'pvid'], String(port.pvid), defaultTo({}, data));
        }
        if (port.vid.length > 0) {
          data = assocPath(['vlan', 'vid'], port.vid.map(String), defaultTo({}, data));
        }

        return assocPath(switchPortPath, defaultTo("''", data), accumulator);
      }, setData);
    deleteData = assocPath([...physicalInterfacePath, 'switch-port'], "''", deleteData);
  }

  // hw instructions for OSPF
  if (pathSatisfies(isNotUndefined, ['ospf'], updateInstructions)) {
    deleteData = assocPath([...physicalInterfacePath, 'ip', 'ospf'], "''", deleteData);

    const { ospfConfig } = updateInstructions.ospf;

    if (isNotNull(ospfConfig)) {
      if (ospfConfig.cost !== null) {
        setData = assocPath([...physicalInterfacePath, 'ip', 'ospf'], {
          cost: ospfConfig.cost,
        }, setData);
      }

      if (ospfConfig.auth === OspfAuthTypeEnum.Md5) {
        setData = assocPath(
          [...physicalInterfacePath, 'ip', 'ospf', 'authentication', 'md5', 'key-id', '1', 'md5-key'],
          ospfConfig.authKey,
          setData
        );
      } else if (ospfConfig.auth === OspfAuthTypeEnum.Plaintext) {
        setData = assocPath(
          [...physicalInterfacePath, 'ip', 'ospf', 'authentication', 'plaintext-password'],
          ospfConfig.authKey,
          setData
        );
      } else if (ospfConfig.auth === OspfAuthTypeEnum.None && ospfConfig.cost !== null) {
        setData = assocPath([...physicalInterfacePath, 'ip', 'ospf'], {
          cost: ospfConfig.cost,
        }, setData);
      } else {
        setData = assocPath([...physicalInterfacePath, 'ip', 'ospf'], "''", setData);
      }
    }
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

  if (isPPPoEInterfaceType(interfaceName)) {
    instructions = updatePPPoEInterface(interfaceName, updateInstructions, this.features);
  } else if (isVlanInterfaceType(interfaceName)) {
    instructions = updateVlanInterface(interfaceName, updateInstructions, this.features);
  } else {
    instructions = updatePhysicalInterface(interfaceName, updateInstructions, this.features);
  }

  const { setData, deleteData } = instructions;

  return this.connection.rpc(setConfigRequest(setData, deleteData));
}

module.exports = constant(updateInterface);

