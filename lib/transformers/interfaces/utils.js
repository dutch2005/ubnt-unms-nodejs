'use strict';

const { when, test, match, anyPass, lensPath } = require('ramda');
const {
  includes, flow, get, overSome, startsWith, split, isNull, replace, head, last,
} = require('lodash/fp');

const { InterfaceIdentificationTypeEnum } = require('../../enums');
const { log } = require('../../logging');
const { isNotString } = require('../../util');

// isVlanOnSwitchInterface :: InterfaceName -> Boolean
//     InterfaceName = String
const isVlanOnSwitchInterface = test(/^switch\d*\.\d+$/);

// isVlanOnEthernetInterface :: InterfaceName -> Boolean
//     InterfaceName = String
const isVlanOnEthernetInterface = test(/^eth\d*\.\d+$/);

// isVlanInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isVlanInterfaceType = overSome([isVlanOnEthernetInterface, isVlanOnSwitchInterface]);

// isPPPoEOnSwitchInterface :: InterfaceName -> Boolean
//     InterfaceName = String
const isPPPoEOnSwitchInterface = test(/^switch\d*\.pppoe\d+$/);

// isPPPoEOnEthernetInterface :: InterfaceName -> Boolean
//     InterfaceName = String
const isPPPoEOnEthernetInterface = test(/^eth\d*\.pppoe\d+$/);

// isPPPoEOnEthernetInterface :: InterfaceName -> Boolean
//     InterfaceName = String
const isPPPoEOnVlanInterface = test(/^eth\d*\.\d+\.pppoe\d+$/);

// isPPPoEOnBridgeInterface :: InterfaceName -> Boolean
//     InterfaceName = String
const isPPPoEOnBridgeInterface = test(/^br\d*\.pppoe\d+$/);

// isPPPoEInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isPPPoEInterfaceType = overSome([
  isPPPoEOnSwitchInterface,
  isPPPoEOnEthernetInterface,
  isPPPoEOnBridgeInterface,
  isPPPoEOnVlanInterface,
  startsWith('pppoe'),
]);

// isSfpInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isSfpInterfaceType = startsWith('sfp+');

// isPonInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isPonInterfaceType = test(/^pon\d+$/);

// isBridgeInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isBridgeInterfaceType = test(/^br\d+$/);

// isEthernetInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isEthernetInterfaceType = test(/^eth\d+$/);

// isSwitchInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isSwitchInterfaceType = test(/^switch\d+$/);

// isPhysicalInterfaceType :: InterfaceName -> Boolean
//     InterfaceName = String
const isPhysicalInterfaceType = anyPass([isEthernetInterfaceType, isSwitchInterfaceType]);

// interfaceNameToType :: InterfaceName -> InterfaceIdentificationTypeEnum
//     InterfaceName = String
//     InterfaceIdentificationTypeEnum = String
const interfaceNameToType = (interfaceName) => {
  if (isVlanInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Vlan;
  } else if (isPPPoEInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.PPPoE;
  } else if (isSfpInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Sfp;
  } else if (isPonInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Pon;
  } else if (isBridgeInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Bridge;
  } else if (isSwitchInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Switch;
  } else if (isEthernetInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Ethernet;
  }

  return interfaceName.replace(/[0-9]\.*/g, '');
};

// interfaceNameToHwProps :: InterfaceName -> HwProps
//     InterfaceName = String
//     HwProps = Object
const interfaceNameToHwProps = (interfaceName) => {
  const hwProps = {
    physicalPort: null,
    switch: null,
    eth: null,
    vlanId: null,
    pppoeId: null,
    section: null,
    name: interfaceName,
    type: interfaceNameToType(interfaceName),
  };
  const typeEnum = InterfaceIdentificationTypeEnum;

  if (hwProps.type === typeEnum.Vlan) {
    const parts = split('.', interfaceName);
    hwProps.physicalPort = head(parts);
    hwProps.eth = isVlanOnEthernetInterface(interfaceName) ? hwProps.physicalPort : null;
    hwProps.switch = isVlanOnSwitchInterface(interfaceName) ? hwProps.physicalPort : null;
    hwProps.vlanId = last(parts);
  }

  if (hwProps.type === typeEnum.PPPoE) {
    const parts = split('.', interfaceName);
    hwProps.physicalPort = head(parts);
    hwProps.eth = isPPPoEOnEthernetInterface(interfaceName) ? hwProps.physicalPort : null;
    hwProps.switch = isPPPoEOnSwitchInterface(interfaceName) ? hwProps.physicalPort : null;
    hwProps.vlanId = isPPPoEOnVlanInterface(interfaceName) ? parts[1] : null;
    hwProps.pppoeId = replace('pppoe', '', last(parts));
  }

  if (includes(hwProps.type, [typeEnum.Pon, typeEnum.Switch])) {
    hwProps.section = hwProps.type;
  } else if (hwProps.type === typeEnum.Ethernet) {
    hwProps.section = 'ethernet';
  } else if (hwProps.type === typeEnum.Sfp) {
    hwProps.section = 'nni';
  } else if (hwProps.type === typeEnum.Bridge) {
    hwProps.section = 'bridge';
  } else if (includes(hwProps.type, [typeEnum.Vlan, typeEnum.PPPoE])) {
    if (hwProps.physicalPort.startsWith('eth')) {
      hwProps.section = 'ethernet';
    } else if (hwProps.physicalPort.startsWith('switch')) {
      hwProps.section = 'switch';
    }
  } else {
    log('error', `Unexpected interface type: ${hwProps.type}`);
  }

  return hwProps;
};

// interfaceNameToVlanId :: InterfaceName -> VlanId
//     InterfaceName = String
//     VlandId = Number
const interfaceNameToVlanId = flow(interfaceNameToHwProps, get('vlanId'), Number);

// interfaceNameToPPPoEId :: InterfaceName -> PPPoEId
//     InterfaceName = String
//     PPPoEId = Number
const interfaceNameToPPPoEId = flow(interfaceNameToHwProps, get('pppoeId'), Number);

// interfaceNameToPhysical :: InterfaceName -> PhysicalPortName
//     InterfaceName = String
//     PhysicalPortName = String
const interfaceNameToPhysical = flow(interfaceNameToHwProps, get('physicalPort'));

// toActualInterfaceName :: InterfaceName -> RealInterfaceName
//     InterfaceName = String
//     RealInterfaceName = String
const toActualInterfaceName = when(isPPPoEInterfaceType, flow(split('.'), last));

// toDisplayName :: {name: String, description: String} -> String
const toDisplayName = ({ name, description }) => {
  const interfaceName = toActualInterfaceName(name);

  if (isNull(description)) { return interfaceName }
  if (interfaceName === description) { return interfaceName }

  return `${description} (${interfaceName})`;
};

// interfaceNameToPosition :: String -> Number
const interfaceNameToPosition = (interfaceName) => {
  if (isNotString(interfaceName)) { return null }
  if (isVlanInterfaceType(interfaceName) && isPPPoEInterfaceType(interfaceName)) { return null }

  return flow(match(/\d+$/), head)(interfaceName);
};

const ospfLens = lensPath(['ip', 'ospf']);

const ospfCostLens = lensPath(['ip', 'ospf', 'cost']);

const ospfPlaintextAuthLens = lensPath(['ip', 'ospf', 'authentication', 'plaintext-password']);

const ospfMd5AuthLens = lensPath(['ip', 'ospf', 'authentication', 'md5', 'key-id', '1', 'md5-key']);

module.exports = {
  isVlanOnSwitchInterface,
  isVlanOnEthernetInterface,
  isVlanInterfaceType,
  isPPPoEOnSwitchInterface,
  isPPPoEOnEthernetInterface,
  isPPPoEInterfaceType,
  isSfpInterfaceType,
  isPonInterfaceType,
  isBridgeInterfaceType,
  isEthernetInterfaceType,
  isSwitchInterfaceType,
  isPhysicalInterfaceType,
  interfaceNameToType,
  interfaceNameToHwProps,
  interfaceNameToVlanId,
  interfaceNameToPPPoEId,
  interfaceNameToPhysical,
  interfaceNameToPosition,
  toDisplayName,

  ospfLens,
  ospfCostLens,
  ospfPlaintextAuthLens,
  ospfMd5AuthLens,
};
