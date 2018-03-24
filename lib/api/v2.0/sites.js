'use strict';

const joi = require('joi');
const { constant, compact, head } = require('lodash/fp');
const { flow, castArray } = require('lodash');

const { registerPlugin } = require('../../util/hapi');
const Validation = require('../../validation');

/*
 * Route definitions
 */
function register(server) {
  const {
    createNewSite, synchronizeSites, createNewImage, getSiteImages, updateSiteById, /* removeImageById, */updateImage,
    filterSitesById, /* removeSiteById, */reorderImages, getSiteImage,
  } = server.plugins.fixtures.sites;

  server.route({
    method: 'GET',
    path: '/v2.0/sites',
    config: {
      validate: {
        query: {
          id: joi.array().items(Validation.siteId.optional()).single(true),
        },
      },
    },
    handler(request, reply) {
      flow(synchronizeSites, filterSitesById(compact(castArray(request.query.id))), reply)();
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/sites',
    config: {
      validate: {
        payload: Validation.newSite,
      },
    },
    handler(request, reply) {
      reply(createNewSite(request.payload));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/sites/{id}',
    config: {
      validate: {
        params: {
          id: Validation.siteId,
        },
      },
    },
    handler(request, reply) {
      flow(synchronizeSites, filterSitesById(castArray(request.params.id)), head, reply)();
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/sites/{id}',
    config: {
      validate: {
        params: {
          id: Validation.siteId,
        },
      },
    },
    handler(request, reply) {
      // removeSiteById(request.params.id);
      reply({ result: true, message: 'Site deleted' });
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.0/sites/{id}',
    config: {
      validate: {
        payload: Validation.site,
        params: {
          id: Validation.siteId,
        },
      },
    },
    handler(request, reply) {
      reply(updateSiteById(request.params.id, request.payload));
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/sites/{siteId}/images/{imageId}',
    config: {
      validate: {
        params: {
          siteId: Validation.siteId,
          imageId: Validation.imageId,
        },
      },
    },
    handler(request, reply) {
      reply(getSiteImage());
    },
  });


  server.route({
    method: 'GET',
    path: '/v2.0/sites/{id}/images',
    config: {
      validate: {
        params: {
          id: Validation.siteId,
        },
      },
    },
    handler(request, reply) {
      reply(getSiteImages());
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/sites/{id}/images',
    config: {
      payload: {
        output: 'stream',
        parse: true,
        maxBytes: 10000000,
        allow: 'multipart/form-data',
      },
      validate: {
        params: {
          id: Validation.siteId,
        },
      },
    },
    handler(request, reply) {
      const file = request.payload.file;
      const files = Array.isArray(file) ? file : [file];

      files.forEach(createNewImage);

      reply(
        Promise
          .resolve()
          .then(constant({ result: true, message: 'Images uploaded' }))
      ).code(201);
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/sites/{siteId}/images/{imageId}',
    config: {
      validate: {
        params: {
          siteId: Validation.siteId,
          imageId: Validation.imageId,
        },
      },
    },
    handler(request, reply) {
      // removeImageById(request.params.imageId);
      reply({ result: true, message: 'Image deleted' });
    },
  });

  server.route({
    method: 'PATCH',
    path: '/v2.0/sites/{siteId}/images/{imageId}',
    config: {
      validate: {
        params: {
          siteId: Validation.siteId,
          imageId: Validation.imageId,
        },
      },
    },
    handler(request, reply) {
      reply(updateImage(request.params.imageId, request.payload));
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/sites/{siteId}/images/{imageId}/reorder',
    config: {
      validate: {
        payload: Validation.imageReorder,
        params: {
          siteId: Validation.siteId,
          imageId: Validation.imageId,
        },
      },
    },
    handler(request, reply) {
      const { currentOrder, nextOrder } = request.payload;
      reorderImages(currentOrder, nextOrder);
      reply({ result: true, message: 'Image reordered' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/sites/{siteId}/images/{imageId}/rotateleft',
    config: {
      validate: {
        params: {
          siteId: Validation.siteId,
          imageId: Validation.imageId,
        },
      },
    },
    handler(request, reply) {
      reply({ result: true, message: 'Image rotated left' });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/sites/{siteId}/images/{imageId}/rotateright',
    config: {
      validate: {
        params: {
          siteId: Validation.siteId,
          imageId: Validation.imageId,
        },
      },
    },
    handler(request, reply) {
      reply({ result: true, message: 'Image rotated right' });
    },
  });
}


/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'sites_v2.0',
  version: '1.0.0',
  dependencies: ['fixtures'],
};
