'use strict';

const parsers = require('./parsers');
const mappers = require('./mappers');
const { toCorrespondence, fromCorrespondence } = require('../../../index');

// fromInfoCommand :: Auxiliaries -> String -> Either.<Object>
//     Auxiliaries = Object
const fromInfoCommand = toCorrespondence(parsers.safeParseInfoCommandOutput);

// fromConfigurationFile :: Auxiliaries -> String -> Either.<Object>
//     Auxiliaries = Object
const fromConfigurationFile = toCorrespondence(parsers.safeParseConfigurationFile);

// toConfigurationFile :: Object -> String
const toConfigurationFile = fromCorrespondence(mappers.safeToConfigurationFile);

module.exports = {
  fromInfoCommand,
  fromConfigurationFile,

  toConfigurationFile,
};
