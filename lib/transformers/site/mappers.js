'use strict';

const { isNull, map } = require('lodash/fp');

const { liftMapper } = require('../index');

// TODO(vladimir.gorej@gmail.com): mapping of users and endpoints must be implemented.

// toApiSiteIdentification :: Object -> ApiSiteIdentification
//     ApiSiteIdentification :: Object
const toApiSiteIdentification = correspondenceData => ({
  id: correspondenceData.identification.id,
  status: correspondenceData.identification.status,
  name: correspondenceData.identification.name,
  parent: correspondenceData.identification.parentId,
  type: correspondenceData.identification.type,
});

// toApiSiteOverview :: Object -> ApiSiteOverview
//     ApiSiteOverview = Object
const toApiSiteOverview = correspondenceData => ({
  identification: toApiSiteIdentification(correspondenceData),
  description: {
    address: correspondenceData.description.address,
    note: correspondenceData.description.note,
    contact: {
      name: correspondenceData.description.contact.name,
      phone: correspondenceData.description.contact.phone,
      email: correspondenceData.description.concat.email,
    },
    location: (() => {
      if (isNull(correspondenceData.location)) { return null }

      return {
        longitude: correspondenceData.location.longitude,
        latitude: correspondenceData.location.latitude,
      };
    })(),
    height: correspondenceData.height,
    elevation: correspondenceData.elevation,
    endpoints: [],
  },
  notifications: {
    type: correspondenceData.notifications.type,
    users: [],
  },
});

// toApiSiteOverviewList :: CorrespondenceList -> ApiSiteOverviewList
//     CorrespondenceList = Array
//     ApiSiteOverviewList = Array.<ApiSiteOverview>
const toApiSiteOverviewList = map(toApiSiteOverview);

// parseCmSiteLocation :: CorrespondenceData -> Object
//     CorrespondenceData = Object
const parseCmSiteLocation = (cmSite) => {
  if (isNull(cmSite.description.location)) { return null }

  return {
    longitude: cmSite.description.location.longitude,
    latitude: cmSite.description.location.latitude,
  };
};

// toDbSite :: SiteCorrespondenceData -> DbSite
//    SiteCorrespondenceData = Object
//    DbSite = Object
const toDbSite = cmSite => ({
  id: cmSite.identification.id,
  identification: {
    id: cmSite.identification.id,
    name: cmSite.identification.name,
    type: cmSite.identification.type,
    status: cmSite.identification.status,
    parent: cmSite.identification.parentId,
  },
  description: {
    address: cmSite.description.address,
    note: cmSite.description.note,
    contact: {
      name: cmSite.description.contact.name,
      phone: cmSite.description.contact.phone,
      email: cmSite.description.contact.email,
    },
    location: parseCmSiteLocation(cmSite),
    endpoints: cmSite.description.endpointIds,
    height: cmSite.description.height,
    elevation: cmSite.description.elevation,
  },
  notifications: {
    type: cmSite.notifications.type,
    users: cmSite.notifications.userIds,
  },
});


module.exports = {
  toApiSiteIdentification,
  toApiSiteOverview,
  toApiSiteOverviewList,
  toDbSite,

  safeToDbSite: liftMapper(toDbSite),
  safeToApiSiteOverview: liftMapper(toApiSiteOverview),
  safeToApiSiteOverviewList: liftMapper(toApiSiteOverviewList),
};
