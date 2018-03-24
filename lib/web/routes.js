'use strict';

const fs = require('fs');
const path = require('path');

const { handleUnknownRoute, parseQueryParams } = require('./index');

/*
 * Hapijs routes definition
 */

function registerRoutes(server, options) {
  const hasIndexHtml = fs.existsSync(path.join(options.publicDir, 'index.html'));

  server.plugins.views.addViewManager(server);

  server.route({
    method: 'GET',
    path: '/',
    config: {
      auth: false,
      ext: {
        onPreResponse: {
          method: parseQueryParams,
        },
      },
    },
    handler: {
      view: {
        template: 'index.html',
      },
    },
  });

  server.route({
    method: 'GET',
    path: '/index.html',
    config: {
      auth: false,
      ext: {
        onPreResponse: {
          method: parseQueryParams,
        },
      },
    },
    handler: {
      view: {
        template: 'index.html',
      },
    },
  });

  server.route({
    method: 'GET',
    path: '/firmwares',
    config: {
      auth: false,
      ext: {
        onPreResponse: {
          method: parseQueryParams,
        },
      },
    },
    handler: {
      view: {
        template: 'index.html',
      },
    },
  });

  server.route({
    method: 'GET',
    path: '/{param*}',
    config: {
      auth: false,
      ext: {
        onPreResponse: {
          method: handleUnknownRoute(hasIndexHtml),
        },
      },
    },
    handler: {
      directory: {
        path: options.publicPaths,
        redirectToSlash: true,
      },
    },
  });
}

module.exports = {
  registerRoutes,
};
