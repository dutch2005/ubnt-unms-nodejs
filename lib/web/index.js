'use strict';

const { NOT_FOUND, FORBIDDEN } = require('http-status');
const { __, any, startsWith } = require('lodash/fp');

const { isNotEmpty } = require('../util');
const config = require('../../config');

// TODO(jaroslav.klima@ubnt.com): all API routes should have a common prefix for this purpose
const isApiRequest = request => any(startsWith(__, `${request.url.path}/`), ['/v2.0/', '/v2.1/']);

const handleUnknownRoute = hasIndexHtml => (request, reply) => {
  const response = request.response;

  if (
    response.isBoom &&
    (response.output.statusCode === NOT_FOUND || response.output.statusCode === FORBIDDEN) &&
    hasIndexHtml &&
    !isApiRequest(request)
  ) {
    return reply.view('index.html');
  }

  return reply.continue();
};

function parseQueryParams(request, reply) {
  const updateVersion = request.query.update;
  if (!config.demo && isNotEmpty(updateVersion)) {
    this.updateVersionOverride = updateVersion;
  }
  return reply.continue();
}

module.exports = {
  parseQueryParams,
  handleUnknownRoute,
};
