'use strict';

const Stream = require('stream');
const { contains } = require('ramda');


class DecorateUnmsStatistics extends Stream.Transform {
  constructor() {
    super({ objectMode: true, decodeStrings: false });
    this.memory = 0;
    this.uptime = 0;
    this.load = 0;
  }

  _transform(goodEvent, encoding, next) {
    const eventName = goodEvent.event;

    if (eventName === 'ops') {
      this.memory = Math.round(goodEvent.proc.mem.rss / (1024 * 1024));
      this.uptime = goodEvent.proc.uptime;
      this.load = goodEvent.os.load;
      next();
      return;
    }

    if (eventName === 'log' && contains('statistics', goodEvent.tags)) {
      /* eslint-disable no-param-reassign */
      goodEvent.data.server.memory = this.memory;
      goodEvent.data.server.load = this.load;
      goodEvent.data.unms.uptime = this.uptime;
      /* eslint-enable no-param-reassign */
    }

    this.push(goodEvent);
    next();
  }
}


module.exports = DecorateUnmsStatistics;
