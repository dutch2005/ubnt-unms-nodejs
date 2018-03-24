'use strict';

const { filter, map, get, curry, flow } = require('lodash/fp');

const { liftParser } = require('../../index');
const { DeviceTypeEnum } = require('../../../enums');
const { isPhysicalInterfaceType } = require('../../interfaces/utils');


// isPhysicalInterface :: CorrespondenceInterface -> Boolean
//     CorrespondenceInterface = Object
const isPhysicalInterface = flow(get(['identification', 'name']), isPhysicalInterfaceType);

// parseMacAddressFromInterface :: InterfaceCorrespondence
//     InterfaceCorrespondence = Object
const parseMacAddressFromInterface = get(['identification', 'mac']);

// parseMacAddressFromPhysicalInterfaces :: Array.<CorrespondenceInterface> -> Array.<String>
//     CorrespondenceInterface = Object
const parseMacAddressFromPhysicalInterfaces = flow(filter(isPhysicalInterface), map(parseMacAddressFromInterface));

// parseMacAddress :: Auxiliaries -> Object -> Array.<String|Null>
//     Auxiliaries = Object
const parseMacAddress = curry(({ interfaceListCorrespondence }, deviceCorrespondence) => {
  const deviceType = deviceCorrespondence.identification.type;

  switch (deviceType) {
    case DeviceTypeEnum.Erouter:
    case DeviceTypeEnum.Olt: {
      return parseMacAddressFromPhysicalInterfaces(interfaceListCorrespondence);
    }
    case DeviceTypeEnum.AirMax:
    case DeviceTypeEnum.AirCube: {
      return [deviceCorrespondence.identification.mac];
    }
    default:
      return [];
  }
});


module.exports = {
  parseMacAddressFromInterface,
  parseMacAddress,

  safeParseMacAddress: liftParser(parseMacAddress),
};
