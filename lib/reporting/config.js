'use strict';

const config = require('../../config');
const {
  allowLoggingToLogentries,
  allowLoggingToSentry,
  getInstanceId,
} = require('../settings');

const AllowedFilter = require('./filters/allowed');
const DecorateEventFilter = require('./filters/decorateEvent');
const NormalizeEventFilter = require('./filters/normalizeEvent');
const ResponseFilter = require('./filters/response');
const DecorateUnmsStatisticsFilter = require('./filters/decorateUnmsStatistics');
const errorFilter = require('./filters/errors');
const ReporterSentry = require('./sentry');
const ReporterLogentries = require('./logentries');

/*
 Event Types

 ops - System and process performance - CPU, memory, disk, and other metrics.
 response - Information about incoming requests and the response. This maps to either the "response" or "tail" event
            emitted from hapi servers.
 log - logging information not bound to a specific request such as system errors, background processing, configuration
       errors, etc. Maps to the "log" event emitted from hapi servers.
 error - request responses that have a status code of 500. This maps to the "request-error" hapi event.
 request - Request logging information. This maps to the hapi 'request' event that is emitted via request.log().

Websocket logging
log: ['info'] - without ws logs
log: ['info','rpc'] - only rpc ws calls
log: ['info','ws'] - complete ws communication
log: ['info','ws','qe'] - complete ws communication + event parsing

 */

const goodConfig = {
  ops: {
    interval: 5000,
  },
  wreck: true,
  includes: {
    request: ['headers', 'payload'],
    response: ['payload'],
  },
  reporters: {
    consoleReporter: [
      {
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [{
          error: '*',
          warn: '*',
          ops: '*',
          response: '*',
          request: '*',
          log: { include: ['info', 'error'], exclude: ['message-hub'] },
        }],
      },
      {
        module: 'good-console',
      },
      'stdout',
    ],
    sentryReporter: [
      {
        module: AllowedFilter,
        args: [allowLoggingToSentry],
      },
      {
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [{ error: '*' }],
      },
      {
        module: 'white-out',
        args: [{
          password: 'censor',
        }],
      },
      {
        module: NormalizeEventFilter,
      },
      {
        module: DecorateEventFilter,
        args: [{ getInstanceId, hostTag: config.hostTag }],
      },
      {
        module: ReporterSentry,
        args: [{
          dsn: config.sentryDSN,
          install: !config.isDevelopment,
          config: {
            // this is to prevent sending unhandledRejections/uncaughtExceptions when reporting to sentry is disabled
            shouldSendCallback: data => allowLoggingToSentry() && errorFilter(data),
            dataCallback: (data) => {
              data.user.id = getInstanceId(); // eslint-disable-line no-param-reassign
              data.server_name = config.hostTag; // eslint-disable-line no-param-reassign
              return data;
            },
          },
        }],
      },
    ],
    logentriesReporter: [
      {
        module: AllowedFilter,
        args: [allowLoggingToLogentries],
      },
      {
        module: 'good-squeeze',
        name: 'Squeeze',
        // exclude timeout errors
        args: [{ log: ['statistics'], ops: '*' }],
      },
      {
        module: ResponseFilter,
        args: [{ methods: ['post', 'put', 'delete'] }],
      },
      {
        module: 'white-out',
        args: [{
          password: 'censor',
        }],
      },
      {
        module: DecorateUnmsStatisticsFilter,
      },
      {
        module: NormalizeEventFilter,
      },
      {
        module: DecorateEventFilter,
        args: [{ getInstanceId, hostTag: config.hostTag }],
      },
      {
        module: ReporterLogentries,
        args: [{ token: config.logentriesToken }],
      },
    ],
  },
};

module.exports = {
  https: goodConfig,
};
