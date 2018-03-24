'use strict';

const { Chance } = require('chance');
const aguid = require('aguid');
const moment = require('moment-timezone');
const { mergeWith, remove, merge } = require('lodash');
const {
  curry, cloneDeep, flow, get, getOr, map, isUndefined, defaultTo, isEmpty, contains, __, spread, add, find,
} = require('lodash/fp');
const { concat, range, equals, ifElse, assocPath, pathEq, filter, pathSatisfies } = require('ramda');
const got = require('got');

const config = require('../../config');
const { SiteTypeEnum, StatusEnum, AlertTypeEnum } = require('../enums');
const { generateRandomLocationWithin } = require('./util');
const { filterDevicesBySiteId, getDevices } = require('./device');
const { isNotEmpty } = require('../util');


const chance = new Chance();
const sites = [];
let lastEndpointId = 10000;
let lastSiteId = 2000;
const PRAGUE_LOC = [50.0791161, 14.4330544];
const IMAGE_URL = '/demo-gallery-image.jpg';
const THUMB_URL = '/demo-gallery-image.jpg';


const findSiteById = siteId => find(pathEq(['identification', 'id'], siteId))(sites);
const isDeviceDisconnected = pathEq(['overview', 'status'], StatusEnum.Disconnected);
const isSomeDeviceDisconnected = flow(filter(isDeviceDisconnected), isNotEmpty);

const generateSiteName = ifElse(equals(SiteTypeEnum.Site),
  () => `${chance.street()}_${chance.integer({ min: 0, max: 20 })}`.replace(/ /, '_'),
  () => `${chance.first()}_${chance.integer({ min: 0, max: 20 })}`
);

const getSiteStatus = (site) => {
  if (isUndefined(site)) { return StatusEnum.Inactive }
  const siteDevices = flow(getDevices, filterDevicesBySiteId(site.identification.id))(sites);

  if (isEmpty(siteDevices)) { return StatusEnum.Inactive }
  if (isSomeDeviceDisconnected(siteDevices)) { return StatusEnum.Disconnected }

  return StatusEnum.Active;
};

const generateSiteIdentification = (id, type, parent = null) => ({
  id,
  type,
  status: getSiteStatus(),
  name: generateSiteName(type),
  parent: cloneDeep(parent),
});

const generateSiteDescription = (identification, location) => ({
  note: null,
  address: `${chance.city()}, ${chance.address()}, ${chance.zip()}, ${chance.country({ full: true })}`,
  location: location ? { latitude: location[0], longitude: location[1] } : null,
  height: chance.integer({ min: 0, max: 100 }),
  elevation: chance.altitude(),
  contact: {
    name: chance.name(),
    phone: chance.phone({ formatted: false }),
    email: chance.email(),
  },
  endpoints: [],
});

const generateSiteNotifications = () => ({
  type: AlertTypeEnum.Custom,
  users: range(1, 3).map(concat('test')).map(username => ({ username, id: aguid(), email: `${username}@test.sk` })),
});

const generateSite = curry(({ type, where, distance, parent = null }, siteId) => {
  const location = where ? generateRandomLocationWithin(distance, where) : null;
  const identification = generateSiteIdentification(siteId, type, parent);
  const description = generateSiteDescription(identification, location);
  const notifications = generateSiteNotifications();

  const newSite = { id: siteId, identification, description, notifications };
  sites.push(newSite);
  return newSite;
});

const generateSites = () => {
  const startSiteId = lastSiteId;
  lastSiteId = startSiteId + config.fixtures.site.count;

  return range(startSiteId, lastSiteId)
    .map(aguid)
    .map(generateSite({
      type: SiteTypeEnum.Site,
      where: PRAGUE_LOC,
      distance: 30000,
    }));
};

const generateEndpoints = map((site) => {
  const { minCount, maxCount } = config.fixtures.endpoint;
  const startEndpointId = lastEndpointId;
  lastEndpointId += chance.natural({ min: minCount, max: maxCount });

  const siteEndpoints = range(startEndpointId, lastEndpointId)
    .map(aguid)
    .map(generateSite({
      type: SiteTypeEnum.Endpoint,
      where: PRAGUE_LOC,
      distance: 1500,
      parent: site.identification,
    }));

  // eslint-disable-next-line no-param-reassign
  site.description.endpoints = siteEndpoints.map(flow(get('identification'), cloneDeep));
  concat(sites, siteEndpoints);
});

const generateSitesAndEndpoints = flow(generateSites, generateEndpoints, () => sites);

const addEndpointToSite = (site, endpoint) => site.description.endpoints.push(get('identification', endpoint));

const createNewSite = (payload) => {
  const { name, address, location, contactName, contactPhone, contactEmail, note, parentSiteId } = payload;
  let type = null;
  let newSiteId = null;

  if (parentSiteId === null) {
    type = SiteTypeEnum.Site;
    newSiteId = lastSiteId;
    lastSiteId += 1;
  } else {
    type = SiteTypeEnum.Endpoint;
    newSiteId = lastEndpointId;
    lastEndpointId += 1;
  }

  const parentSite = defaultTo(null, sites.find(pathEq(['identification', 'id'], parentSiteId)));
  const parent = getOr(null, 'identification', parentSite);

  const site = flow(
    aguid,
    generateSite({ type, parent }),
    assocPath(['identification', 'name'], name),
    assocPath(['description', 'address'], address),
    assocPath(['description', 'location'], location),
    assocPath(['description', 'contact', 'name'], contactName),
    assocPath(['description', 'contact', 'phone'], contactPhone),
    assocPath(['description', 'contact', 'email'], contactEmail),
    assocPath(['description', 'note'], note)
  )(newSiteId);

  if (parentSite !== null) {
    addEndpointToSite(parentSite, site);
  }

  return site;
};

const synchronizeSites = () => {
  sites.forEach((site) => {
    // eslint-disable-next-line no-param-reassign
    site.identification.status = getSiteStatus(site);
  });

  return sites;
};

const updateSiteCustomizer = (objValue, srcValue) => {
  if (Array.isArray(objValue)) return srcValue;
  return undefined;
};

const updateSiteById = (siteId, requestPayload) => {
  const site = findSiteById(siteId);
  return mergeWith(site, requestPayload, updateSiteCustomizer);
};

const filterSitesById = curry((siteIds, sitesToFilter) => {
  if (isEmpty(siteIds)) { return sitesToFilter }
  return sitesToFilter.filter(pathSatisfies(contains(__, siteIds), ['identification', 'id']));
});

const removeSiteById = siteId => remove(sites, pathEq(['identification', 'id'], siteId));


/*
 * Images
 */
const generateImage = (imageId, order) => ({
  identification: {
    id: imageId,
  },
  name: `Image name - ${imageId}`,
  description: `Image description - ${imageId}`,
  fileName: `image_filename_${imageId}.jpg`,
  fileType: 'image/jpeg',
  height: 789,
  width: 1262,
  size: 2342,
  date: moment().toISOString(),
  thumbUrl: IMAGE_URL,
  fullUrl: THUMB_URL,
  order,
});


const reorderImage = curry((currentOrder, nextOrder, image) => {
  if (image.order === currentOrder) {
    image.order = nextOrder; // eslint-disable-line no-param-reassign
  } else if (currentOrder < nextOrder && image.order > currentOrder && image.order <= nextOrder) {
    image.order -= 1; // eslint-disable-line no-param-reassign
  } else if (image.order < currentOrder && image.order >= nextOrder) {
    image.order += 1; // eslint-disable-line no-param-reassign
  }
});

const siteImages = range(2100, 2120).map(value => [aguid(value), value]).map(spread(generateImage));

const reorderImages = (currentOrder, nextOrder) => siteImages.forEach(reorderImage(currentOrder, nextOrder));

const getSiteImages = () => siteImages;

const getNextOrder = flow(map('order'), Math.max, add(1));

const createNewImage = ({ hapi: { filename } }) => {
  const newImage = generateImage(aguid(), getNextOrder(siteImages));
  const newNamedImage = Object.assign({}, newImage, { name: filename });

  return siteImages.push(newNamedImage);
};

const updateImage = (imageId, requestPayload) => {
  const image = siteImages.find(pathEq(['identification', 'id'], imageId));
  merge(image, requestPayload);
  return image;
};

const removeImageById = imageId => remove(siteImages, pathEq(['identification', 'id'], imageId));

const getSiteImage = () => got.stream(IMAGE_URL);


/*
 *  Module
 */
module.exports = {
  createNewImage,
  createNewSite,
  filterSitesById,
  generateSitesAndEndpoints,
  getSiteImage,
  getSiteImages,
  removeImageById,
  removeSiteById,
  reorderImages,
  synchronizeSites,
  updateImage,
  updateSiteById,
};
