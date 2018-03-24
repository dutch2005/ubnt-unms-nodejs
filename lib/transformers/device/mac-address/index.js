'use strict';

const { getOr, map, flow, flatten, compact } = require('lodash/fp');


const { safeToApiMacAddress, safeToApiMacAddressList } = require('./mappers');
const { safeParseMacAddress, parseMacAddress } = require('./parsers');
const { toCorrespondence, fromCorrespondence, liftEither } = require('../../index');
const { parseDbDevice } = require('../parsers');
const { parseDbInterfaceList } = require('../../interfaces/parsers');


// fromDeviceCorrespondence :: Auxiliaries -> DbDevice -> Either.<Correspondence>
//     Auxiliaries = Object
//     DbDevice = Object
//     Correspondence = Object
const fromDeviceCorrespondence = toCorrespondence(safeParseMacAddress);

// toApiMacAddress :: Correspondence -> Either.<String>
//     Correspondence = Object
const toApiMacAddress = fromCorrespondence(safeToApiMacAddress);

// toApiMacAddressList :: CorrespondenceList -> Either.<String[]>
//     CorrespondenceList = Array.<Object>
const toApiMacAddressList = fromCorrespondence(safeToApiMacAddressList);

/**
 * Fusion shortcuts.
 *
 * We parse device and interface correspondence form to get the device MAC address.
 * It is more convenient to parse format that we already know and have parsers for,
 * than primitive source objects.
 */

// fromDbDeviceFS :: Object -> [String|Null]
//     Correspondence = Object
const fromDbDeviceFS = (dbDevice) => {
  const dbInterfaceList = getOr([], 'interfaces', dbDevice);
  const deviceCorrespondence = parseDbDevice({}, dbDevice);
  const interfaceListCorrespondence = parseDbInterfaceList({ dbDevice }, dbInterfaceList);

  return parseMacAddress({ interfaceListCorrespondence }, deviceCorrespondence);
};

// fromDbDeviceListFS :: Array.<DbDevice> -> CorrespondenceList
//     DbDevice = Object
//     CorrespondenceList = Array.<String>
const fromDbDeviceListFS = flow(map(fromDbDeviceFS), flatten, compact);


module.exports = {
  fromDeviceCorrespondence,
  toApiMacAddress,
  toApiMacAddressList,

  fromDbDevice: liftEither(1, fromDbDeviceFS),
  fromDbDeviceList: liftEither(1, fromDbDeviceListFS),
};
