'use strict';

const vision = require('vision');
const mustache = require('mustache');

const { registerPlugin } = require('../util/hapi');

function register(server, options) {
  let defaultContext = {};

  if (options.demo) {
    defaultContext = {
      injectHead: '<script> window.UNMS_DEMO = true; </script>',
    };
  }

  const addViewManager = serverInstance => serverInstance.register(vision, (err) => {
    if (err) {
      throw err;
    }

    serverInstance.views({
      engines: {
        html: {
          compile: (template) => {
            mustache.parse(template, ['<!--', '-->']);

            return context => mustache.render(template, context);
          },
        },
      },
      path: options.templatePaths,
      context: defaultContext,
    });
  });

  server.expose({ addViewManager });
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'views',
  version: '1.0.0',
};

