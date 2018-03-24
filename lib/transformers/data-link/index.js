'use strict';

const { safeParseDbDataLink, safeParseDbDataLinkList } = require('./parsers');
const { toCorrespondence } = require('../index');


// fromDb :: Auxiliaries -> DbDataLink -> Either.<Object>
//     Auxiliaries = Object
//     DbDataLink = Object
const fromDb = toCorrespondence(safeParseDbDataLink);

// fromDbList :: Auxiliaries -> Array.<DbDataLink> -> Either.<Object>
//     Auxiliaries = Object
//     DbDataLink = Object
const fromDbList = toCorrespondence(safeParseDbDataLinkList);


module.exports = {
  fromDb,
  fromDbList,
};
