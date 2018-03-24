'use strict';

const { toCorrespondence, fromCorrespondence } = require('../index');
const { safeToApiNmsSummary, safeToApiSmtp, safeToDbNms, safeToApiNmsSettings } = require('./mappers');
const {
  safeParseDbNmsSummary, safeParseDbNms, safeParseApiSmtp, safeParseDbNmsSettings, safeParseApiNmsSettings,
} = require('./parsers');

// fromDbNmsSummary :: Auxiliaries -> DbData -> Either.<NmsSummaryCorrespondenceData>
//    Auxiliaries = Object
//    DbData = Object
//    NmsSummaryCorrespondenceData = Object
const fromDbNmsSummary = toCorrespondence(safeParseDbNmsSummary);

// fromDbNms :: Auxiliaries -> DbNms -> Either.<NmsCorrespondenceData>
//    Auxiliaries = Object
//    DbNms = Object
//    NmsCorrespondenceData = Object
const fromDbNms = toCorrespondence(safeParseDbNms);

// fromDbNmsSettings :: Auxiliaries -> DbNmsSettings -> Either.<NmsSettingsCorrespondenceData>
//    Auxiliaries = Object
//    DbNmsSettings = Object
//    NmsSettingsCorrespondenceData = Object
const fromDbNmsSettings = toCorrespondence(safeParseDbNmsSettings);

// toApiNmsSummary :: Object<NmsSummaryCorrenspondeceData> -> Either.<ApiNmsSummary>
//     ApiNmsSummary = Object
const toApiNmsSummary = fromCorrespondence(safeToApiNmsSummary);

// fromApiSmtp :: Auxiliaries -> ApiSmtpSettings -> Either.<CmSmtpSettings>
//    Auxiliaries = Object
//    ApiSmtpSettings = Object
const fromApiSmtp = toCorrespondence(safeParseApiSmtp);

// fromApiNmsSettings :: Auxiliaries -> ApiNmsSettings -> Either.<CmNmsSettings>
//    Auxiliaries = Object
//    ApiNmsSettings = Object
const fromApiNmsSettings = toCorrespondence(safeParseApiNmsSettings);

// toApiSmtp :: NmsCorrenspondenceData -> Either.<ApiSmtp>
//     NmsCorrenspondenceData = Object
//     ApiSmtp = Object
const toApiSmtp = fromCorrespondence(safeToApiSmtp);

// toApiNmsSettings :: NmsSettingsCorrenspondenceData -> Either.<ApiNmsSettings>
//     NmsSettingsCorrenspondenceData = Object
//     ApiNmsSettings = Object
const toApiNmsSettings = fromCorrespondence(safeToApiNmsSettings);

// toDbNms :: NmsCorrenspondenceData -> Either.<DbNms>
//     NmsCorrenspondenceData = Object
//     DbNms = Object
const toDbNms = fromCorrespondence(safeToDbNms);


module.exports = {
  fromDbNmsSummary,
  fromDbNms,
  fromDbNmsSettings,

  toDbNms,

  toApiNmsSummary,
  toApiSmtp,
  toApiNmsSettings,

  fromApiSmtp,
  fromApiNmsSettings,
};
