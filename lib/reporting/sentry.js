'use strict';

const Stream = require('stream');
const Raven = require('raven');
const { defaults, omit, isNil } = require('lodash/fp');

const version = require('../../package.json').version;

const defaultConfig = {
  logger: '',
  release: version,
  environment: '',
  captureUnhandledRejections: false,
};

const applyDefaultConfig = defaults(defaultConfig);

const filterExtraAttributes = omit([
  'level', 'tags', 'error', 'stackTrace', 'message', 'instance', 'serverName', 'hostTag',
]);

class ReporterSentry extends Stream.Writable {
  static handleSentryError(error) {
    console.error('Sentry logging error', error);
  }

  constructor({ dsn = null, config = {}, install = false } = {}) {
    super({ objectMode: true, decodeStrings: false });

    const settings = applyDefaultConfig(config);
    const args = (dsn === null) ? [settings] : [dsn, settings];

    this.client = new Raven.Client(...args);
    // error handler is required, otherwise the EventEmitter will throw Error
    this.client.on('error', ReporterSentry.handleSentryError);
    if (install) {
      this.client.install();
    }
  }

  _write(event, encoding, cb) {
    const extraData = {
      level: event.level,
      extra: filterExtraAttributes(event),
    };

    if (event.event === 'error' && !isNil(event.error)) {
      this.client.captureException(event.error, extraData, cb);
    } else {
      this.client.captureMessage(event.message, extraData, cb);
    }
  }
}

module.exports = ReporterSentry;
