'use strict';

const aguid = require('aguid');
const { Form } = require('multiparty');
const { Observable } = require('rxjs/Rx');
const { flow, curry, identity, constant, partial, merge, partialRight, spread, includes } = require('lodash');
const { mergeWith, get, map, defaultTo, compact, getOr, omit, isString, noop } = require('lodash/fp');
const { filter, assocPath, pathEq, find, without, head, last, test } = require('ramda');
const joi = require('joi');
const sharp = require('sharp');
const moment = require('moment-timezone');
const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs-extra'));
const boom = require('boom');
const cloneable = require('cloneable-readable');
const { isNotNil } = require('ramda-adjunct');

// improve memory consumption
sharp.cache(false);
sharp.concurrency(1);

const { registerPlugin } = require('../../../util/hapi');
const config = require('../../../../config');
const { DB } = require('../../../db');
const { entityExistsCheck, tapP, bytesFormatter } = require('../../../util');
const { SiteTypeEnum, StatusEnum, AlertTypeEnum } = require('../../../enums');
const validation = require('../../../validation');
const service = require('./service');
const { getSiteImagesDir, getSiteImagesFilePath, getSiteImagesFileUrl } = require('./util');

/*
 * Business logic
 */
const { unlinkAsync, readFileAsync, ensureDirAsync } = fs;

// increase on image change (eg. image rotate) so the FE client gets varying URLs
let imagesVersion = 0;

const createSite = ({ name, address, contactName, contactPhone, contactEmail,
                      note, location, parentSiteId, height, elevation }) => {
  const id = aguid();
  const type = parentSiteId ? SiteTypeEnum.Endpoint : SiteTypeEnum.Site;
  const alertType = type === SiteTypeEnum.Endpoint ? AlertTypeEnum.None : AlertTypeEnum.System;
  return {
    id,
    identification: {
      id,
      name,
      type,
      status: StatusEnum.Inactive,
      parent: parentSiteId,
    },
    description: {
      address,
      note,
      location,
      height,
      elevation,
      contact: { name: contactName, phone: contactPhone, email: contactEmail },
      endpoints: [],
    },
    notifications: { type: alertType, users: [] },
  };
};

const filterSites = (ids) => {
  if (!ids) { return identity }
  return filter(flow(get('id'), partial(includes, ids)));
};

const createNewImagesData = (newImages, maxOrderNumber) => {
  let order = maxOrderNumber;
  return newImages.map((data) => {
    const { id, name, imageInfo } = data;
    const { format, height, width, size } = imageInfo;
    order += 1;
    return {
      id,
      name,
      height,
      width,
      order,
      fileName: name,
      identification: { id },
      description: '',
      date: moment().format(),
      size: Math.round(size / 1024),
      fileType: format,
    };
  });
};

const saveImage = (fileStream, siteId) => {
  const { width, height } = config.siteImages.thumb;
  const maxResolution = config.siteImages.maxResolution;

  const id = aguid();
  const name = fileStream.filename;

  return ensureDirAsync(getSiteImagesDir(siteId))
    .then(() => new Promise((resolve, reject) => {
      const stream = cloneable(fileStream);

      const imageFile = getSiteImagesFilePath(siteId, id);
      const thumbFile = getSiteImagesFilePath(siteId, id, true);

      let callCounter = 2; // await two callbacks call before resolve
      let imageInfo = null;

      // for some reason it's not possible to clone pipelines
      const imagePipeline = sharp()
        .sequentialRead()
        .limitInputPixels(maxResolution)
        .jpeg()
        .toFile(imageFile, (err, data) => {
          callCounter -= 1;
          if (isNotNil(err)) {
            callCounter = 0; // prevent resolve
            reject(err);
          } else if (callCounter === 0) {
            resolve({ imageInfo: data, name, id, siteId });
          } else {
            imageInfo = data;
          }
        });

      const thumbPipeline = sharp()
        .sequentialRead()
        .limitInputPixels(maxResolution)
        .resize(width, height)
        .jpeg()
        .toFile(thumbFile, (err) => {
          callCounter -= 1;
          if (isNotNil(err)) {
            callCounter = 0; // prevent resolve
            reject(err);
          } else if (callCounter === 0) {
            resolve({ imageInfo, name, id, siteId });
          }
        });

      stream.clone().pipe(imagePipeline);
      stream.pipe(thumbPipeline);
    }));
};

const getImageAbsUrl = curry((hostname, siteId, image) => {
  const imageId = image.id;
  return flow(
    assocPath(['thumbUrl'], `${hostname}${getSiteImagesFileUrl(siteId, imageId, true)}?v=${imagesVersion}`),
    assocPath(['fullUrl'], `${hostname}${getSiteImagesFileUrl(siteId, imageId)}?v=${imagesVersion}`)
  )(image);
});

const deleteImageFiles = (siteId, fileId) => Promise.all([
  unlinkAsync(getSiteImagesFilePath(siteId, fileId)),
  unlinkAsync(getSiteImagesFilePath(siteId, fileId, true)),
]).catch((err) => {
  console.error(`Failed to remove image files: ${fileId}. ${err}`);
  throw err;
});

const handleRotation = (request, reply, direction) => {
  imagesVersion += 1;
  const angle = direction === 'left' ? 270 : 90;
  const { siteId, imageId } = request.params;
  const fileName = getSiteImagesFilePath(siteId, imageId);
  const thumbName = getSiteImagesFilePath(siteId, imageId, true);

  return reply(
    DB.site.findById(siteId)
      .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
      .then(partial(DB.site.findImageById, siteId, imageId))
      .then(tapP(entityExistsCheck('siteImage')))
      .then(() => {
        const thumbPromise = readFileAsync(thumbName)
          .then(thumbData => sharp(thumbData).rotate(angle).toFile(thumbName));
        const filePromise = readFileAsync(fileName)
          .then(fileData => sharp(fileData).rotate(angle).toFile(fileName));

        return Promise.all([thumbPromise, filePromise]);
      })
      .then(constant({ result: true, message: `Image rotated ${direction}` }))
  );
};

const updateSiteCustomizer = (objValue, srcValue, key) => {
  if (Array.isArray(objValue)) return srcValue;
  if (key === 'parent') {
    return getOr(null, ['id'], srcValue);
  }
  if (key === 'description') {
    return assocPath(['endpoints'], map('id', srcValue.endpoints), srcValue);
  }
  if (key === 'notifications') {
    return assocPath(['users'], map('id', srcValue.users), srcValue);
  }
  return undefined;
};

const updateSite = (payload, site) => mergeWith(updateSiteCustomizer, site, payload);

const checkSiteHasNoEndpoints = (site) => {
  if (site.identification.type === SiteTypeEnum.Site && site.description.endpoints.length > 0) {
    throw boom.badData('The site contains enpoints.');
  }
  return site;
};

const checkSiteHasNoDevices = (site, devices) => {
  const siteDevices = filter(pathEq(['identification', 'site', 'id'], site.id), devices);
  if (siteDevices.length > 0) {
    throw boom.badData('The site contains devices.');
  }
};

const addEndpointToSite = (parentSite, endpointSite) => {
  let parent = parentSite;
  let endpoint = endpointSite;
  if (parentSite !== null) {
    const endpoints = parentSite.description.endpoints.slice();
    endpoints.push(endpoint.id);
    parent = assocPath(['description', 'endpoints'], endpoints, parent);
    endpoint = assocPath(['identification', 'parent'], parent.id, endpoint);
  }
  return [parent, endpoint];
};

const removeEndpointFromSite = (parentSite, endpoint) => {
  let parent = parentSite;
  if (parentSite !== null) {
    parent = assocPath(['description', 'endpoints'],
      without([endpoint.id], parent.description.endpoints),
      parent);
  }
  return [parent, endpoint];
};

const lookupSiteById = (id, sites) => defaultTo(null, find(pathEq(['id'], id), sites));

const addEndpointToParentSiteById = (newParentId, endpoint, sites) =>
  addEndpointToSite(lookupSiteById(newParentId, sites), endpoint);

const removeEndpointFromParentSite = (endpoint, sites) =>
  removeEndpointFromSite(lookupSiteById(endpoint.identification.parent, sites), endpoint);

const getIdentificationBySiteId = (id, sites) => get(['identification'], lookupSiteById(id, sites));

const linkParent = (sites, site) => assocPath(
  ['identification', 'parent'],
  getIdentificationBySiteId(site.identification.parent, sites),
  site);

const linkEndpoints = (sites, site) => assocPath(
  ['description', 'endpoints'],
  site.description.endpoints.map(endpointId => getIdentificationBySiteId(endpointId, sites)),
  site);

const addSiteEndpointRelationsToSite = curry((sites, site) => (site.identification.type === SiteTypeEnum.Endpoint
  ? linkParent(sites, site)
  : linkEndpoints(sites, site)
));

const addSiteUserRelationsToSite = curry((users, site) => assocPath(
  ['notifications', 'users'],
  filter(flow(
    get('id'),
    partial(includes, site.notifications.users)), users.map(omit(['password', 'totpAuthSecret', 'role', 'profile'])
  )),
  site)
);

const addSiteEndpointRelations = (sites, requestSites) => requestSites.map(addSiteEndpointRelationsToSite(sites));

const addSiteUserRelations = (users, requestSites) => requestSites.map(addSiteUserRelationsToSite(users));

const updateSiteData = curry((newParentId, site, parentSite, sites) => {
  if (newParentId === site.identification.parent) {
    return Promise.resolve(site);
  }
  return Promise.all([
    Promise.resolve(removeEndpointFromSite(parentSite, site))
      .then(compact)
      .then(map(DB.site.update)),
    Promise.resolve(addEndpointToParentSiteById(newParentId, site, sites))
      .then(compact)
      .then(map(DB.site.update)),
  ]).then(constant(site));
});

const isPixelLimitError = test(/Input image exceeds pixel limit/);
const isMaxSizeExceededResponse = test(/Payload content length greater than maximum allowed/);

const customizeUploadErrorMessage = (request, reply) => {
  const response = reply.request.response;

  if (response.isBoom) {
    if (isMaxSizeExceededResponse(response.message)) {
      const maxSize = bytesFormatter(config.siteImages.maxBytes);
      response.output.payload.message = `Maximum upload size of ${maxSize} exceeded.`;
    } else if (isPixelLimitError(response.message)) {
      response.output.payload.message = 'Maximum image size exceeded.';
    }
  }

  return reply.continue();
};

/*
 * Route definitions
 */
function register(server) {
  server.route({
    method: 'GET',
    path: '/v2.1/sites',
    config: {
      validate: {
        query: {
          id: joi.array().items(validation.siteId.optional()).single(true),
        },
      },
    },
    handler(request, reply) {
      const { user } = server.plugins;
      const allSitesPromise = DB.site.list();

      const dbUsers = user
        .getUsers()
        .promise();

      const requestedSitesPromise = allSitesPromise
        .then(filterSites(request.query.id));

      reply(
        Promise.all([allSitesPromise, requestedSitesPromise])
          .then(spread(addSiteEndpointRelations))
          .then(sites => Promise.all([dbUsers, sites]))
          .then(spread(addSiteUserRelations))
      );
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/sites',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: validation.newSite,
      },
    },
    handler(request, reply) {
      const payload = request.payload;

      const parentSitePromise = payload.parentSiteId
        ? DB.site.findById(payload.parentSiteId)
          .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
        : null;

      const endpointPromise = Promise.resolve(createSite(payload))
        .then(tapP(DB.site.insert));

      reply(
        Promise
          .all([parentSitePromise, endpointPromise])
          .then(spread(addEndpointToSite))
          .then(compact)
          .then(tapP(map(DB.site.update)))
          .then(last)
      ).code(201);
    },
  });


  server.route({
    method: 'GET',
    path: '/v2.1/sites/{id}',
    config: {
      validate: {
        params: {
          id: validation.siteId,
        },
      },
    },
    handler(request, reply) {
      const { user } = server.plugins;
      const allSitesPromise = DB.site.list();

      const dbUsers = user
        .getUsers()
        .promise();

      const sitePromise = DB.site.findById(request.params.id)
        .then(tapP(entityExistsCheck(SiteTypeEnum.Site)));

      reply(
        Promise.all([allSitesPromise, sitePromise])
          .then(spread(addSiteEndpointRelationsToSite))
          .then(site => Promise.all([dbUsers, site]))
          .then(spread(addSiteUserRelationsToSite))
      );
    },
  });


  server.route({
    method: 'DELETE',
    path: '/v2.1/sites/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.siteId,
        },
      },
    },
    handler(request, reply) {
      const deleteSitePromise = DB.site.findById(request.params.id)
        .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
        .then(tapP(checkSiteHasNoEndpoints))
        .then(site => Promise.all([site, DB.device.list()]))
        .then(tapP(spread(checkSiteHasNoDevices)))
        .then(head);

      const allSitesPromise = DB.site.list();

      reply(
        Promise.all([deleteSitePromise, allSitesPromise])
          .then(spread(removeEndpointFromParentSite))
          .then(compact)
          .then(tapP(map(DB.site.update)))
          .then(last)
          .then(DB.site.remove)
          .then(count => ({ result: true, message: `${count} site(s) deleted.` }))
      );
    },
  });


  server.route({
    method: 'PUT',
    path: '/v2.1/sites/{id}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          id: validation.siteId,
        },
        payload: validation.site,
      },
    },
    handler(request, reply) {
      const { user } = server.plugins;
      const { payload } = request;

      const dbUsers = user
        .getUsers()
        .promise();

      const dbSitePromise = DB.site.findById(request.params.id)
        .then(tapP(entityExistsCheck(SiteTypeEnum.Site)));

      const dbParentSitePromise = dbSitePromise
        .then(dbSite => ((dbSite.identification.type === SiteTypeEnum.Site)
          ? null
          : DB.site.findById(dbSite.identification.parent)
            .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
        ));

      const dbAllSitesPromise = dbSitePromise
        .then(() => DB.site.list());

      reply(
        Promise.all([dbSitePromise, dbParentSitePromise, dbAllSitesPromise])
          .then(spread(updateSiteData(getOr(null, ['identification', 'parent', 'id'], payload))))
          .then(site => updateSite(payload, site))
          .then(tapP(DB.site.update))
          .then(site => Promise.all([dbAllSitesPromise, site]))
          .then(spread(addSiteEndpointRelationsToSite))
          .then(site => Promise.all([dbUsers, site]))
          .then(spread(addSiteUserRelationsToSite))
      );
    },
  });


  server.route({
    method: 'GET',
    path: '/v2.1/sites/{siteId}/images/{imageId}',
    config: {
      validate: {
        params: {
          siteId: validation.siteId,
          imageId: validation.imageId,
        },
      },
    },
    handler(request, reply) {
      const { siteId, imageId } = request.params;

      reply(
        service.getSiteImage(siteId, imageId).run({ DB })
      );
    },
  });


  server.route({
    method: 'DELETE',
    path: '/v2.1/sites/{siteId}/images/{imageId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          siteId: validation.siteId,
          imageId: validation.imageId,
        },
      },
    },
    handler(request, reply) {
      const { siteId, imageId } = request.params;

      reply(
        DB.site.findById(siteId)
          .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
          .then(partial(DB.site.findImageById, siteId, imageId))
          .then(tapP(entityExistsCheck('siteImage')))
          .then(DB.site.removeImage(siteId))
          .then(tapP(partial(deleteImageFiles, siteId, imageId)))
          .then(count => ({ result: true, message: `${count} image(s) deleted` }))
      );
    },
  });


  server.route({
    method: 'GET',
    path: '/v2.1/sites/{id}/images',
    config: {
      validate: {
        params: {
          id: validation.siteId,
        },
      },
    },
    handler(request, reply) {
      const siteId = request.params.id;
      const hostname = `https://${request.info.host}/`;

      reply(
        DB.site.findById(siteId)
          .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
          .then(partial(DB.site.listImages, siteId))
          .then(map(getImageAbsUrl(hostname, siteId)))
      );
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/sites/{id}/images',
    config: {
      auth: {
        scope: 'admin',
      },
      payload: {
        output: 'stream',
        parse: false,
        maxBytes: config.siteImages.maxBytes,
        allow: 'multipart/form-data',
      },
      validate: {
        params: {
          id: validation.siteId,
        },
      },
      ext: {
        onPreResponse: {
          method: customizeUploadErrorMessage,
        },
      },
    },
    handler(request, reply) {
      const siteId = request.params.id;
      const rawRequest = request.raw.req;
      const form = new Form();

      const error$ = Observable.fromEvent(form, 'error').mergeMap(Observable.throw);
      const close$ = Observable.fromEvent(form, 'close');
      const parts$ = Observable.fromEvent(form, 'part')
        .merge(error$)
        .takeUntil(close$)
        .mergeMap((part) => {
          if (!isString(part.filename)) {
            part.resume();
            return Observable.empty();
          }

          return saveImage(part, siteId);
        })
        .toArray(); // buffer to single array

      Observable.forkJoin(parts$, DB.site.getMaxImageOrderNumber(siteId))
        .map(spread(createNewImagesData))
        .mergeMap(newImages => Promise.all(newImages.map(DB.site.insertImage(siteId))))
        .subscribe(
          noop,
          reply,
          () => reply({ result: true, message: 'Images uploaded' })
        );

      form.parse(rawRequest);
    },
  });


  server.route({
    method: 'PATCH',
    path: '/v2.1/sites/{siteId}/images/{imageId}',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          siteId: validation.siteId,
          imageId: validation.imageId,
        },
        payload: validation.imageData,
      },
    },
    handler(request, reply) {
      const { siteId, imageId } = request.params;

      reply(
        DB.site.findById(siteId)
          .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
          .then(partial(DB.site.findImageById, siteId, imageId))
          .then(tapP(entityExistsCheck('siteImage')))
          .then(partialRight(merge, request.payload))
          .then(DB.site.updateImage(siteId))
          .then(constant({ result: true, message: 'Image updated' }))
      );
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/sites/{siteId}/images/{imageId}/reorder',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: validation.imageReorder,
        params: {
          siteId: validation.siteId,
          imageId: validation.imageId,
        },
      },
    },
    handler(request, reply) {
      const { siteId, imageId } = request.params;
      const { currentOrder, nextOrder } = request.payload;

      reply(
        DB.site.findById(siteId)
          .then(tapP(entityExistsCheck(SiteTypeEnum.Site)))
          .then(partial(DB.site.findImageById, siteId, imageId))
          .then(tapP(entityExistsCheck('siteImage')))
          .then(() => DB.site.reorderImage(currentOrder, nextOrder, siteId))
          .then(constant({ result: true, message: 'Image reordered' }))
      );
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/sites/{siteId}/images/{imageId}/rotateleft',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          siteId: validation.siteId,
          imageId: validation.imageId,
        },
      },
    },
    handler(request, reply) {
      return handleRotation(request, reply, 'left');
    },
  });


  server.route({
    method: 'POST',
    path: '/v2.1/sites/{siteId}/images/{imageId}/rotateright',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        params: {
          siteId: validation.siteId,
          imageId: validation.imageId,
        },
      },
    },
    handler(request, reply) {
      return handleRotation(request, reply, 'right');
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'sites_v2.1',
  version: '1.0.0',
  dependencies: ['user'],
};
