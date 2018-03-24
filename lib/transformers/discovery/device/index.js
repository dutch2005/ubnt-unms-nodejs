'use strict';

const parsers = require('./parsers');
const mappers = require('./mappers');
const { toCorrespondence, fromCorrespondence } = require('../../index');

// fromHw :: Auxiliaries -> HwDiscoveryDevice -> Either.<Object>
//     Auxiliaries = Object
//     HwDiscoveryDevice = Object
const fromHw = toCorrespondence(parsers.safeParseHwDiscoveryDevice);

// fromDb :: Auxiliaries -> DbDiscoveryDevice -> Either.<Object>
//     Auxiliaries = Object
//     DbDiscoveryDevice = Object
const fromDb = toCorrespondence(parsers.safeParseDbDiscoveryDevice);

// fromDbList :: Auxiliaries -> DbDiscoveryDeviceList -> Either.<Object>
//     Auxiliaries = Object
//     DbDiscoveryDeviceList = Array.<Object>
const fromDbList = toCorrespondence(parsers.safeParseDbDiscoveryDeviceList);

// toDb :: Correspondence -> Either.<DbDiscoveryDevice>
//     Correspondence = Object
const toDb = fromCorrespondence(mappers.safeToDbDiscoveryDevice);

module.exports = {
  fromHw,
  fromDb,
  fromDbList,

  toDb,
};
