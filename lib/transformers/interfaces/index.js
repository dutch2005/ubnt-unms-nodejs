'use strict';

const {
  safeToApiInterfaceOverviewList, safeToApiInterfaceConfig, safeToDbInterface, safeToDbInterfaceList,
} = require('./mappers');
const {
  safeParseDbInterface, safeParseDbInterfaceList, safeParseApiInterfaceConfig, safeParseApiInterfaceOspfConfig,
  safeParseInterfaceListAddresses, safeParseInterfaceListIpAddressCidr,
} = require('./parsers');

const { toCorrespondence, fromCorrespondence } = require('../index');


// fromDb :: Auxiliaries -> DbInterface -> Either.<Object>
//    Auxiliaries = Object
//    DbInterface = Object
const fromDb = toCorrespondence(safeParseDbInterface);

// fromDbList :: Auxiliaries -> DbInterfaceList -> Either.<Array>
//    Auxiliaries = Object
//    DbInterfaceList = Array.<Object>
const fromDbList = toCorrespondence(safeParseDbInterfaceList);

// fromApiConfig :: Auxiliaries -> ApiInterfaceConfig -> Either.<Object>
//    Auxiliaries = Object
//    ApiInterfaceConfig = Object
const fromApiConfig = toCorrespondence(safeParseApiInterfaceConfig);

// toApiOverviewList :: CorrespondenceList -> Either.<Object>
//    CorrespondenceList = Array.<Object>
const toApiOverviewList = fromCorrespondence(safeToApiInterfaceOverviewList);

// toApiConfig :: Correspondence -> Either.<Object>
//    Correspondence = Object
const toApiConfig = fromCorrespondence(safeToApiInterfaceConfig);

// toDbInterface :: Correspondence -> Either.<DbInterface>
//    Correspondence = Object
//    DbInterface  = Object
const toDbInterface = fromCorrespondence(safeToDbInterface);

// toDbInterfaceList :: Array.<Correspondence> -> Either.<Array.<DbInterface>>
//    Correspondence = Object
//    DbInterface = Object
const toDbInterfaceList = fromCorrespondence(safeToDbInterfaceList);

// fromApiOspfConfig :: Object -> Either.<Object>
const fromApiOspfConfig = toCorrespondence(safeParseApiInterfaceOspfConfig, {});

// fromCmListToAddresses :: Auxiliaries -> Array.<Correspondence> -> Array.<String>
//    Auxiliaries = Object
//    Correspondence = Object
const fromCmListToAddresses = toCorrespondence(safeParseInterfaceListAddresses);

// fromCmListToCidr :: Auxiliaries -> Array.<Correspondence> -> String
//    Auxiliaries = Object
//    Correspondence = Object
const fromCmListToCidr = toCorrespondence(safeParseInterfaceListIpAddressCidr);

module.exports = {
  toApiOverviewList,
  toApiConfig,
  toDbInterface,
  toDbInterfaceList,

  fromDb,
  fromDbList,
  fromApiConfig,
  fromApiOspfConfig,
  fromCmListToAddresses,
  fromCmListToCidr,
};
