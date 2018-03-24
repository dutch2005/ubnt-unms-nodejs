'use strict';

const { toCorrespondence, fromCorrespondence } = require('../index');

const { safeParseApiMobileDevice, safeParseDbMobileDevice } = require('./parsers');
const { safeToDbMobileDevice } = require('./mappers');

// fromApiMobileDevice :: Auxiliaries -> ApiMobileDevice -> CorrespondenceMobileDevice
//    Auxiliaries = Object
//    ApiMobileDevice = Object
//    CorrespondenceMobileDevice = Object
const fromApiMobileDevice = toCorrespondence(safeParseApiMobileDevice);

// fromDbMobileDevice :: Auxiliaries -> DbMobileDevice -> CorrespondenceMobileDevice
//    Auxiliaries = Object
//    DbMobileDevice = Object
//    CorrespondenceMobileDevice = Object
const fromDbMobileDevice = toCorrespondence(safeParseDbMobileDevice);

// toDbMobileDevice :: CmMobileDevice ->  DbMobileDevice
//    CmMobileDevice = Object
//    DbMobileDevice = Object
const toDbMobileDevice = fromCorrespondence(safeToDbMobileDevice);

module.exports = {
  fromApiMobileDevice,
  fromDbMobileDevice,
  toDbMobileDevice,
};
