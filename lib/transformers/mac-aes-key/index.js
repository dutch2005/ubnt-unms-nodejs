'use strict';

const parsers = require('./parsers');
const { toCorrespondence } = require('../index');


// fromDb :: Auxiliaries -> DbMacAesKey -> Either.<CmMacAesKey>
//     Auxiliaries = Object
//     DbMacAesKey = Object
const fromDb = toCorrespondence(parsers.safeParseDbMacAesKey);

// fromDbList :: Auxiliaries -> Array.<DbMacAesKey> -> Either.<Array.<CmMacAesKey>>
//     Auxiliaries = Object
//     DbMacAesKey = Object
const fromDbList = toCorrespondence(parsers.safeParseDbMacAesKeyList);

// castMacAesKeyToDevice :: Auxiliaries -> DbMacAesKey -> DbDevice
//     Auxiliaries = Object
//     DbMacAesKey = Object
const castMacAesKeyToDevice = toCorrespondence(parsers.castMacAesKeyToDevice);


module.exports = {
  fromDb,
  fromDbList,
  castMacAesKeyToDevice,
};
