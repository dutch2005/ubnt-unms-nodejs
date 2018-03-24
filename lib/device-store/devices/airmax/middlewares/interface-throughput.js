'use strict';

const { evolve } = require('ramda');
const { map, getOr, isUndefined, merge } = require('lodash/fp');

const { MessageNameEnum } = require('../../../backends/airos/enums');

const handleOverflow = (newValue, oldValue) => {
  if (newValue < oldValue) {
    // overflow happened
    if (oldValue > 0x7FFFFFFF) {
      return (0xFFFFFFFF - oldValue) + newValue;
    }

    if ((newValue + oldValue) < 0x8FFFFFFF) {
      return newValue; // not sure about this
    }

    return (0x7FFFFFFF - oldValue) + newValue;
  }

  return newValue - oldValue;
};

class AirMaxInterfaceThroughputMiddleware {
  constructor() {
    // used for computing correct throughput
    this.lastUptime = 0;
    this.lastTimestamp = 0;
    this.interfaceThroughput = {};
  }

  computeInterfaceThroughput(timeElapsed, iface) {
    const name = iface.ifname;
    const currentData = {
      rxBytes: iface.status.rx_bytes,
      txBytes: iface.status.tx_bytes,
    };
    let lastData = this.interfaceThroughput[name];

    if (isUndefined(lastData)) {
      lastData = currentData;
      this.interfaceThroughput[name] = lastData;
    }

    const rates = {
      rxrate: ((handleOverflow(currentData.rxBytes, lastData.rxBytes) * 1000) / timeElapsed) * 8,
      txrate: ((handleOverflow(currentData.txBytes, lastData.txBytes) * 1000) / timeElapsed) * 8,
    };

    this.interfaceThroughput[name] = currentData;

    return merge(iface, {
      status: rates,
    });
  }

  handleStatusMessage(message) {
    const data = message.data;
    const uptime = getOr(0, ['host', 'uptime'], data);
    const timestamp = getOr(null, ['host', 'timestamp'], data);

    let timeElapsed = 0;

    const uptimeDiff = (uptime - this.lastUptime) * 1000;

    // replace timestamp with uptime
    if (timestamp === null) {
      timeElapsed = uptimeDiff;
    } else {
      timeElapsed = timestamp < this.lastTimestamp
        ? ((0xFFFFFFFF - this.lastTimestamp) + 1) + timestamp
        : timestamp - this.lastTimestamp;

      this.lastTimestamp = timestamp;
    }

    if (timeElapsed > (uptimeDiff + 1000)) {
      timeElapsed = uptimeDiff;
    }

    this.lastUptime = uptime;

    // sanity check
    if (timeElapsed <= 0) {
      return message;
    }

    return evolve({
      data: {
        interfaces: map(this.computeInterfaceThroughput.bind(this, timeElapsed)),
      },
    }, message);
  }

  handleIncoming(message) {
    switch (message.name) {
      case MessageNameEnum.Status:
        return this.handleStatusMessage(message);
      default:
      // do nothing
    }

    return message;
  }
}

const createMiddleware = () => new AirMaxInterfaceThroughputMiddleware();

module.exports = createMiddleware;

