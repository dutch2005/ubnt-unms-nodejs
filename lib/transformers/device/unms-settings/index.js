'use strict';

const { fromDb } = require('../index');
const { safeToApiUnmsSettings } = require('./mappers');
const { safeParseUnmsSettings, safeParseApiUnmsSettings } = require('./parsers');
const { mergeDbDeviceUnmsSettings } = require('./mergers');
const { toCorrespondence, fromCorrespondence } = require('../../index');

// fromDbDevice :: Auxiliaries -> cmDevice -> Either.<Object>
//     Auxiliaries = Object
//     DbDevice = Object
const fromDeviceCorrespondence = toCorrespondence(safeParseUnmsSettings);

// fromApiUnmsSettings :: Auxiliaries -> ApiDeviceUnmsSettings -> Either.<Object>
//     Auxiliaries = Object
//     ApiDeviceUnmsSettings= Object
const fromApiUnmsSettings = toCorrespondence(safeParseApiUnmsSettings);

// toApiUnmsSettings :: CorrespondenceData -> Either.<Object>
//     CorrespondenceData = Object
const toApiUnmsSettings = fromCorrespondence(safeToApiUnmsSettings);

/**
 * Fusion shortcuts.
 */
// fromDbDevice :: DbDevice -> Either.<Correspondence>
//     DbDevice = Object
//     Correspondence = Object
const fromDbDevice = dbDevice => fromDb({}, dbDevice)
  .chain(fromDeviceCorrespondence({}));

module.exports = {
  fromDbDevice,
  fromApiUnmsSettings,
  fromDeviceCorrespondence,

  toApiUnmsSettings,

  mergeDbDeviceUnmsSettings,
};
