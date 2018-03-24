'use strict';

const { safeToApiSiteOverview, safeToApiSiteOverviewList, safeToDbSite } = require('./mappers');
const { safeParseDbSite, safeParseDbSiteList } = require('./parsers');


const { toCorrespondence, fromCorrespondence } = require('../index');

// fromDb :: Auxiliaries -> DbSite -> Either.<Object>
//     Auxiliaries = Object
//     DbSite = Object
const fromDb = toCorrespondence(safeParseDbSite);

// fromDbList :: Auxiliaries -> Array.<DbSite> -> Either.<Object>
//     Auxiliaries = Object
//     DbSite = Object
const fromDbList = toCorrespondence(safeParseDbSiteList);


// toApiOverview :: Correspondence -> Either.<Object>
//     Correspondence = Object
const toApiOverview = fromCorrespondence(safeToApiSiteOverview);

// toApiOverviewList :: CorrespondenceList -> Either.<Object>
//     CorrespondenceList = Array.<Object>
const toApiOverviewList = fromCorrespondence(safeToApiSiteOverviewList);

// toDb :: SiteCorrenspondenceData -> Either.<DbSite>
//     SiteCorrenspondenceData = Object
//     DbNms = DbSite
const toDb = fromCorrespondence(safeToDbSite);

module.exports = {
  fromDb,
  fromDbList,

  toDb,

  toApiOverview,
  toApiOverviewList,
};
