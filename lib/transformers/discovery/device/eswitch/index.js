'use strict';

const parsers = require('./parsers');
const { toCorrespondence } = require('../../../index');

// fromDashboardHtml :: Auxiliaries -> String -> Either.<Object>
//     Auxiliaries = Object
const fromDashboardHtml = toCorrespondence(parsers.safeParseDashboardHtml);

module.exports = {
  fromDashboardHtml,
};
