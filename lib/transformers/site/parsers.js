'use strict';

const { pathEq } = require('ramda');
const { isNull, curry, map } = require('lodash/fp');

const { liftParser } = require('../index');

// TODO(vladimir.gorej@gmail.com): parsing auxiliaries of dbUser and dbEndpoint must be implemented.

// parseDbSiteLocation :: Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseDbSiteLocation = (dbSite) => {
  if (isNull(dbSite.description.location)) { return null }

  return {
    longitude: dbSite.description.location.longitude,
    latitude: dbSite.description.location.latitude,
  };
};

// praseDbSiteIdentification :: Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseDbSiteIdentification = dbSite => ({
  id: dbSite.identification.id,
  name: dbSite.identification.name,
  type: dbSite.identification.type,
  status: dbSite.identification.status,
  parentId: dbSite.identification.parent,
});

// parseDbSite :: Object -> Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseDbSite = curry((auxiliaries, dbSite) => {
  if (pathEq(['options', 'allowNull'], true, auxiliaries) && dbSite === null) { return null }

  return {
    identification: parseDbSiteIdentification(dbSite),
    description: {
      address: dbSite.description.address,
      note: dbSite.description.note,
      contact: {
        name: dbSite.description.contact.name,
        phone: dbSite.description.contact.phone,
        email: dbSite.description.contact.email,
      },
      location: parseDbSiteLocation(dbSite),
      endpointIds: dbSite.description.endpoints,
      endpoints: null,
      height: dbSite.description.height,
      elevation: dbSite.description.elevation,
    },
    notifications: {
      type: dbSite.notifications.type,
      userIds: dbSite.notifications.users,
      users: null,
    },
  };
});

// parseDbSiteList :: (Object, Array.<DbSite>) -> Array.<Correspondence>
//     DbSite = Object
//     Correspondence = Object
const parseDbSiteList = (auxiliaries, dbSites) => map(parseDbSite(auxiliaries), dbSites);


module.exports = {
  parseDbSiteLocation,
  parseDbSiteIdentification,
  parseDbSite,
  parseDbSiteList,

  safeParseDbSite: liftParser(parseDbSite),
  safeParseDbSiteList: liftParser(parseDbSiteList),
};
