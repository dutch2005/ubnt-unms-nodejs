'use strict';

const { match } = require('ramda');
const { startsWith, flow, head } = require('lodash/fp');


const { InterfaceIdentificationTypeEnum } = require('../../../../enums');


// isEthernetInterfaceType :: InterfaceName -> Boolean
//    InterfaceName = String
const isEthernetInterfaceType = startsWith('eth');

// isWifiInterfaceType :: InterfaceName -> Boolean
//    InterfaceName = String
const isWifiInterfaceType = startsWith('wifi');

// isLogicalInterfaceType :: InterfaceName -> Boolean
//    InterfaceName = String
const isLogicalWifiInterfaceType = startsWith('ath');

// isBridgeInterfaceType :: InterfaceName -> Boolean
//    InterfaceName = String
const isBridgeInterfaceType = startsWith('br');

// TODO(vladimir.gorej@gmail.com): we return null for ath[0-9]+ for now
// interfaceNameToType :: String -> InterfaceType
//     InterfaceType = String|Null
const interfaceNameToType = (interfaceName) => {
  if (isEthernetInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Ethernet;
  } else if (isBridgeInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Bridge;
  } else if (isLogicalWifiInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Logical;
  } else if (isWifiInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Wifi;
  }
  return null;
};

// interfaceNameToPosition :: String -> Number
const interfaceNameToPosition = flow(match(/\d+$/), head);

// isIntStationMode :: String -> Boolean
const isInStationMode = startsWith('sta');

/**
 * @param {string} content
 * @return {string}
 */
const trimHttpHeaders = (content) => {
  let position = content.indexOf('\r\n\r\n');

  if (position !== -1) {
    return content.substring(position + 4);
  }

  position = content.indexOf('\n\n');

  if (position !== -1) {
    return content.substring(position + 2);
  }

  return content;
};

module.exports = {
  isEthernetInterfaceType,
  isWifiInterfaceType,
  isLogicalWifiInterfaceType,
  isBridgeInterfaceType,
  interfaceNameToPosition,
  interfaceNameToType,
  isInStationMode,
  trimHttpHeaders,
};
