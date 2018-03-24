'use strict';

const { Observable, Scheduler } = require('rxjs/Rx');
const { first, map, reduce, sumBy, sortBy, flow, has, keyBy, identity, __, curry } = require('lodash/fp');
const ip = require('ip');
const { isNotNull } = require('ramda-adjunct');

const { error: logError } = require('../logging');

const UDP_PORT = 10001;
const DISCOVERY_PACKET = new Buffer([0x1, 0x0, 0x0, 0x0]);

/**
 * @callback workerCallback
 * @param {any} payload
 * @return {Observable}
 */

class JobQueue {
  /**
   * @param {workerCallback} worker
   * @param {number} concurrency
   */
  constructor(worker, concurrency = 1) {
    this.queue = [];
    this.concurrency = concurrency;
    this.ongoing = 0;

    this.jobs = {};
    this.processing = {};
    this.worker = worker;
  }

  enqueue(jobId, payload) {
    this.jobs[jobId] = payload;
    this.queue.push(jobId);

    if (this.ongoing < this.concurrency) {
      this.process();
    }
  }

  process() {
    if (this.ongoing >= this.concurrency) {
      throw new Error('Too many jobs in progress');
    }

    let jobId = this.queue.shift();
    while (!has(jobId, this.jobs) && this.queue.length > 0) { jobId = this.queue.shift() }

    if (!has(jobId, this.jobs)) { return }

    const payload = this.jobs[jobId];
    delete this.jobs[jobId];

    this.ongoing += 1;
    this.processing[jobId] = this.worker.call(null, payload)
      .finally(() => { // process another job when observable completes
        delete this.processing[jobId];
        this.ongoing -= 1;
        if (this.ongoing < this.concurrency) {
          this.process();
        }
      })
      .subscribe({
        error(err) {
          logError('Job processing failed', err);
        },
      });
  }

  cancel(jobId) {
    if (has(jobId, this.processing)) {
      this.processing[jobId].unsubscribe(); // cleanup is handled in subscription
    } else if (has(jobId, this.jobs)) {
      delete this.jobs[jobId]; // queue is handled automatically
    }
  }
}

/**
 * Parser output
 *
 * @typedef {Object} IpRange
 * @property {string} type
 * @property {string} [ip]
 * @property {string} [cidr]
 * @property {string} [mask]
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [part]
 */

/**
 * @param {IpRange} range
 * @return {{from: number, to: number}}
 */
// TODO(michal.sedlak@ubnt.com): Logic duplicated on the client
const normalizeRange = (range) => {
  switch (range.type) {
    case 'cidr': {
      const { firstAddress, lastAddress } = ip.cidrSubnet(range.cidr);
      return { from: ip.toLong(firstAddress), to: ip.toLong(lastAddress) };
    }
    case 'mask': {
      const { firstAddress, lastAddress } = ip.subnet(range.ip, range.mask);
      return { from: ip.toLong(firstAddress), to: ip.toLong(lastAddress) };
    }
    case 'explicit': {
      const from = ip.toLong(range.from);
      const to = ip.toLong(range.to);
      if (from < to) {
        return { from, to };
      }
      return { from: to, to: from };
    }
    case 'partial': {
      const from = ip.toLong(range.ip);
      const to = ip.toLong(`${range.ip.split('.').slice(0, -1).join('.')}.${range.part}`);
      if (from < to) {
        return { from, to };
      }

      return { from: to, to: from };
    }
    case 'single': {
      const single = ip.toLong(range.ip);
      return { from: single, to: single };
    }
    default:
      throw new Error('Unknown IP range type');
  }
};

const collapseOverlappingInterval = (collapsed, range) => {
  if (collapsed === null) { return [range] }

  const top = first(collapsed);
  if (range.from < top.to && range.to > top.to) {
    top.to = range.to;
  } else if (range.from > top.to) {
    collapsed.unshift(range);
  }

  return collapsed;
};

const privateRanges = [
  ip.cidrSubnet('10.0.0.0/8'),
  ip.cidrSubnet('100.64.0.0/10'),
  ip.cidrSubnet('172.16.0.0/12'),
  ip.cidrSubnet('192.168.0.0/16'),
].map(({ firstAddress, lastAddress }) => ({ from: ip.toLong(firstAddress), to: ip.toLong(lastAddress) }));

/**
 * @param {{from: number, to: number}} range
 * @return {number}
 */
const ipRangeSize = range => (range.to - range.from) + 1;

const publicIpRangeSize = (range) => {
  const size = ipRangeSize(range);
  let privateSize = 0;

  for (const privateRange of privateRanges) { // eslint-disable-line no-restricted-syntax
    // range in large than private range
    if (range.from < privateRange.from && range.to > privateRange.to) {
      privateSize += (privateRange.to - privateRange.from) + 1;
      // range is inside private range
    } else if (range.from >= privateRange.from && range.to <= privateRange.to) {
      privateSize = size;
      break;
      // range overlaps private range
    } else if (range.from < privateRange.from && range.to > privateRange.from && range.to <= privateRange.to) {
      privateSize += (range.to - privateRange.from) + 1;
    } else if (range.from >= privateRange.from && range.from < privateRange.to && range.to > privateRange.to) {
      privateSize += (privateRange.to - range.from) + 1;
    }
  }

  return size - privateSize;
};

/**
 * @function collapseOverlappingIpRanges
 * @param {Array.<IpRange>} ranges
 * @return {Array.<{from: number, to: number}>}
 */
const collapseOverlappingIpRanges = flow(
  map(normalizeRange),
  sortBy('from'),
  reduce(collapseOverlappingInterval, null)
);

/**
 * @function ipRangesSize
 * @param {Array.<IpRange>} ranges
 * @return {number}
 */
const ipRangesSize = flow(
  collapseOverlappingIpRanges,
  sumBy(ipRangeSize)
);

/**
 * @function publicIpRangesSize
 * @param {Array.<IpRange>} ranges
 * @return {number}
 */
const publicIpRangesSize = flow(
  collapseOverlappingIpRanges,
  sumBy(publicIpRangeSize)
);

const isInIpRange = curry((address, range) => address >= range.from && address <= range.to);

const AddressList = {};

AddressList.fromList = (ipAddressList) => {
  const lookup = keyBy(identity, ipAddressList);
  return {
    contains: has(__, lookup),
    toObservable() { return Observable.from(ipAddressList) },
  };
};

/**
 * @param {Array.<IpRange>} ranges
 * @return {Observable}
 */
AddressList.fromRanges = (ranges) => {
  const collapsedRanges = collapseOverlappingIpRanges(ranges);

  return {
    contains(ipAddress) {
      const ipAddressAsLong = ip.toLong(ipAddress);
      return collapsedRanges.some(isInIpRange(ipAddressAsLong));
    },
    toObservable() {
      let rangeIndex = 0;
      return Observable.generate({
        initialState: collapsedRanges[rangeIndex].from,
        condition: isNotNull,
        iterate: (prevIp) => {
          const nextIp = prevIp + 1;
          const range = collapsedRanges[rangeIndex];
          if (nextIp > range.to) {
            if (collapsedRanges.length === rangeIndex + 1) { return null }

            rangeIndex += 1;
            return collapsedRanges[rangeIndex].from;
          }

          return nextIp;
        },
        resultSelector: ip.fromLong,
        scheduler: Scheduler.asap, // ensures lazy generation
      });
    },
  };
};

module.exports = {
  AddressList,
  ipRangesSize,
  publicIpRangesSize,
  JobQueue,
  UDP_PORT,
  DISCOVERY_PACKET,
};
