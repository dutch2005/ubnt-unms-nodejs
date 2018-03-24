'use strict';

const {
  safeToApiONUStatusOverview, safeToApiONUStatusOverviewList, safeToDbDevice,
  safeToApiDeviceStatusOverview, safeToApiDeviceStatusOverviewList, safeToApiErouterStatusDetail,
  safeToApiOLTStatusDetail, safeToApiAirMaxStatusDetail, safeToApiAirCubeStatusDetail,
  safeToApiEswitchStatusDetail, toDbDevice, safeToApiStationList,
} = require('./mappers');
const {
  parseDbDevice, parseDbDeviceList, safeParseDbDevice, safeParseDbDeviceList, safeParseApiOnuUpdateRequest,
} = require('./parsers');
const { toCorrespondence, fromCorrespondence } = require('../index');


// fromDb :: Auxiliaries -> DbDevice -> Either.<Object>
//     Auxiliaries = Object
//     DbDevice = Object
const fromDb = toCorrespondence(safeParseDbDevice);

// fromDbUnsafe :: Auxiliaries -> DbDevice -> CorrespondenceDevice
//     Auxiliaries = Object
//     DbDevice = Object
//     CorrespondenceDevice = Object
const fromDbUnsafe = toCorrespondence(parseDbDevice);

// fromDbList :: Auxiliaries -> Array.<DbDevice> -> Either.<Object>
//     Auxiliaries = Object
//     DbDevice = Object
const fromDbList = toCorrespondence(safeParseDbDeviceList);

// fromDbListUnsafe :: Auxiliaries -> Array.<DbDevice> -> Array.<CorrespondenceDevice>
//     Auxiliaries = Object
//     DbDevice = Object
const fromDbListUnsafe = toCorrespondence(parseDbDeviceList);

// toApiDeviceStatusOverview :: CorrespondenceData -> Either.<Object>
//     CorrespondenceData = Object
const toApiDeviceStatusOverview = fromCorrespondence(safeToApiDeviceStatusOverview);

// toApiDeviceStatusOverviewList :: CorrespondenceList -> Either.<Object>
//     CorrespondenceList = Array.<Object>
const toApiDeviceStatusOverviewList = fromCorrespondence(safeToApiDeviceStatusOverviewList);

// toApiONUStatusOverview :: CorrespondenceData -> Either.<Object>
//     CorrespondenceData = Object
const toApiONUStatusOverview = fromCorrespondence(safeToApiONUStatusOverview);

// toApiONUStatusOverviewList :: CorrespondenceList -> Either.<Object>
//     CorrespondenceList = Array.<Object>
const toApiONUStatusOverviewList = fromCorrespondence(safeToApiONUStatusOverviewList);

// toApiErouterStatusDetail :: CorrespondenceData -> Either.<ApiErouterStatusDetail>
//     CorrespondenceData = Object
//     ApiErouterStatusDetail = Object
const toApiErouterStatusDetail = fromCorrespondence(safeToApiErouterStatusDetail);

// toApiEswitchStatusDetail :: CorrespondenceData -> Either.<ApiEswitchStatusDetail>
//     CorrespondenceData = Object
//     ApiEswitchStatusDetail = Object
const toApiEswitchStatusDetail = fromCorrespondence(safeToApiEswitchStatusDetail);

// toApiOLTStatusDetail :: CorrespondenceData -> Either.<ApiOLTStatusDetail>
//     CorrespondenceData = Object
//     ApiOLTStatusDetail = Object
const toApiOLTStatusDetail = fromCorrespondence(safeToApiOLTStatusDetail);

// toApiAirMaxStatusDetail :: CorrespondenceData -> Either.<ApiAirMaxStatusDetail>
//     CorrespondenceData = Object
//     ApiAirMaxStatusDetail = Object
const toApiAirMaxStatusDetail = fromCorrespondence(safeToApiAirMaxStatusDetail);

// toApiAirCubeStatusDetail :: CorrespondenceData -> Either.<ApiAirCubeStatusDetail>
//     CorrespondenceData = Object
//     ApiAirCubeStatusDetail = Object
const toApiAirCubeStatusDetail = fromCorrespondence(safeToApiAirCubeStatusDetail);

// toApiStationList :: CorrespondenceList -> Either.<Object>
//     CorrespondenceList = Array.<Object>
const toApiStationList = fromCorrespondence(safeToApiStationList);


// toDb :: Correspondence -> Either.<DbDevice>
//     Correspondence = Object
//     DbDevice = Object
const toDb = fromCorrespondence(safeToDbDevice);

// toDbUnsafe :: Correspondence -> DbDevice
//     Correspondence = Object
//     DbDevice = Object
const toDbUnsafe = fromCorrespondence(toDbDevice);

// fromApiOnuPatchRequest :: (Auxiliaries, ApiOnuUpdateRequest) -> Either.<CmOnuUpdateRequest>
//    Auxiliaries = Object  = Object
//    ApiOnuUpdateRequest   = Object
//    CmOnuUpdateRequest    = Object
const fromApiOnuPatchRequest = toCorrespondence(safeParseApiOnuUpdateRequest, {});


module.exports = {
  fromDb,
  fromDbUnsafe,
  fromDbList,
  fromDbListUnsafe,

  toApiDeviceStatusOverview,
  toApiDeviceStatusOverviewList,
  toApiONUStatusOverview,
  toApiONUStatusOverviewList,
  toApiErouterStatusDetail,
  toApiOLTStatusDetail,
  toApiAirMaxStatusDetail,
  toApiAirCubeStatusDetail,
  toApiEswitchStatusDetail,
  toDb,
  toDbUnsafe,
  toApiStationList,
  fromApiOnuPatchRequest,
};
