'use strict';

const { curry, map } = require('ramda');

const { liftParser } = require('../index');


// parseDbDataLink :: Object -> Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseDbDataLink = curry((auxiliaries, dbDataLink) => ({
  id: dbDataLink.id,
  deviceIdFrom: dbDataLink.deviceIdFrom,
  interfaceNameFrom: dbDataLink.interfaceNameFrom,
  deviceIdTo: dbDataLink.deviceIdTo,
  interfaceNameTo: dbDataLink.interfaceNameTo,
  origin: dbDataLink.origin,
}));

// parseDbDataLinkList :: (Object, Array.<DbDataLink>) -> Array.<Correspondence>
//     DbDataLink = Object
//     Correspondence = Object
const parseDbDataLinkList = curry((auxiliaries, dbDataLinkList) => map(parseDbDataLink(auxiliaries), dbDataLinkList));


module.exports = {
  safeParseDbDataLink: liftParser(parseDbDataLink),
  safeParseDbDataLinkList: liftParser(parseDbDataLinkList),
};
