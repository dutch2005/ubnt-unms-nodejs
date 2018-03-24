'use strict';

const parsers = require('./parsers');
const { toCorrespondence } = require('../../../index');

// fromInfoCommand :: Auxiliaries -> String -> Either.<Object>
//     Auxiliaries = Object
const fromInfoCommand = toCorrespondence(parsers.safeParseInfoCommandOutput);

module.exports = {
  fromInfoCommand,
};
