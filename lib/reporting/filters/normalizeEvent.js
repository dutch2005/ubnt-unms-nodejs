'use strict';

const Stream = require('stream');
const { T, constant } = require('lodash/fp');
const { any, contains, __, cond } = require('ramda');

const version = require('../../../package.json').version;

const containsError = any(contains(__, ['err', 'error']));
const containsWarning = any(contains(__, ['warn', 'warning']));
const containsInfo = any(contains(__, ['info']));

const tagsToLogLevel = cond([
  [containsError, constant('error')],
  [containsWarning, constant('warning')],
  [containsInfo, constant('info')],
  [T, constant('debug')],
]);

class NormalizeEventFilter extends Stream.Transform {
  constructor() {
    super({ objectMode: true, decodeStrings: false });
  }

  _transform(goodEvent, encoding, next) {
    const eventName = goodEvent.event;
    let tags = [];

    if (Array.isArray(goodEvent.tags)) {
      tags = goodEvent.tags.slice();
    } else if (goodEvent.tags) {
      tags = [goodEvent.tags];
    }

    tags.unshift(eventName);

    const level = tagsToLogLevel(tags);
    let additionalData = {};

    if (eventName === 'error') {
      additionalData = {
        error: goodEvent.error,
        stackTrace: goodEvent.error.stack,
        message: goodEvent.error.message,
      };
    } else if (eventName === 'ops') {
      const memory = Math.round(goodEvent.proc.mem.rss / (1024 * 1024));
      const uptime = goodEvent.proc.uptime;
      const load = goodEvent.os.load;

      additionalData = {
        memory,
        uptime,
        load,
        message: `memory: ${memory}Mb, uptime (seconds): ${uptime}, load: [${load}]`,
      };
    } else if (eventName === 'response') {
      const query = goodEvent.query || {};
      const method = goodEvent.method;
      const statusCode = goodEvent.statusCode || '';
      const path = goodEvent.path;
      const responseTime = goodEvent.responseTime;

      additionalData = {
        method,
        query,
        statusCode,
        path,
        responseTime,
        message: `${method} ${path} ${JSON.stringify(query)} ${statusCode} (${responseTime}ms)`,
      };
    } else if (eventName === 'log') {
      additionalData = {
        tags,
      };
    }

    this.push(Object.assign({
      level,
      version,
      event: eventName,
      message: goodEvent.data || '(none)',
    }, additionalData));

    next();
  }
}

module.exports = NormalizeEventFilter;
