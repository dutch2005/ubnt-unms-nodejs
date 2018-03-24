'use strict';

const { assign } = require('lodash/fp');

const { ServerUnavailableError } = require('./errors');
const { getClientIpFromRequest, toMs } = require('../util');

const VERIFY_CLIENT_LAG = toMs('seconds', 20);
const DEFAULTS = {
  interval: 0,
  maxHeapUsedBytes: 0,             // reject connections when V8 heap is over size in bytes (zero is no max)
  maxRssBytes: 0,                  // reject connections when process RSS is over size in bytes (zero is no max)
  maxEventLoopDelay: 0,            // milliseconds of delay after which connections are rejected (zero is no max)
};

const toMilliseconds = hrtime => (hrtime[0] * 1e3) + (hrtime[1] / 1e6);

class Guard {
  constructor(options = {}, logging) {
    this.options = assign(DEFAULTS, options);
    this.logging = logging;
    this.laggedConnections = new Set();
    this.timeoutId = null;

    this.status = {
      eventLoopDelay: 0,
      heapUsed: 0,
      rss: 0,
    };
  }

  verifyClient(options, callback) {
    const result = this.check();
    if (result instanceof ServerUnavailableError) {
      const remoteAddress = getClientIpFromRequest(options.req);
      this.logging.log(['info', 'ws', 'guard'], `Connection from ${remoteAddress} rejected. ${result.message}`);

      // create artificial lag to delay device reconnection
      const timeoutId = setTimeout(() => {
        this.laggedConnections.delete(timeoutId);
        callback(false, result.statusCode, result.message);
      }, VERIFY_CLIENT_LAG);

      this.laggedConnections.add(timeoutId);
      return;
    }

    callback(true);
  }

  elapsed() {
    return toMilliseconds(process.hrtime(this.ts));
  }

  start() {
    if (this.options.interval === 0) {
      return;
    }

    const loop = () => {
      this.ts = process.hrtime();

      const measure = () => {
        const mem = process.memoryUsage();

        this.status.eventLoopDelay = this.elapsed() - this.options.interval;
        this.status.heapUsed = mem.heapUsed;
        this.status.rss = mem.rss;

        loop();
      };

      this.timeoutId = setTimeout(measure, this.options.interval);
    };

    loop();
  }

  stop() {
    clearTimeout(this.timeoutId);
    this.laggedConnections.forEach(clearTimeout);
    this.timeoutId = null;
  }

  check() {
    if (this.options.interval === 0) {
      return true;
    }

    const elapsed = this.elapsed();
    const status = this.status;

    if (elapsed > this.options.interval) {
      status.eventLoopDelay = Math.max(status.eventLoopDelay, elapsed - this.options.interval);
    }

    if (this.options.maxEventLoopDelay !== 0 && status.eventLoopDelay > this.options.maxEventLoopDelay) {
      return new ServerUnavailableError('Server unavailable due to heavy load (event loop)', status);
    }

    if (this.options.maxHeapUsedBytes !== 0 && status.heapUsed > this.options.maxHeapUsedBytes) {
      return new ServerUnavailableError('Server unavailable due to heavy load (heap used)', status);
    }

    if (this.options.maxRssBytes !== 0 && status.rss > this.options.maxRssBytes) {
      return new ServerUnavailableError('Server unavailable due to heavy load (rss)', status);
    }

    return true;
  }
}

module.exports = Guard;
