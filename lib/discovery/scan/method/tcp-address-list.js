'use strict';

const { Observable } = require('rxjs/Rx');
const { Socket } = require('net');
const { nthArg } = require('ramda');
const { SmartBuffer } = require('smart-buffer');

const { DISCOVERY_PACKET } = require('../../utils');

const tcpDiscoveryRequest = address => Observable.create((observer) => {
  const client = new Socket();

  const buffer = [];

  client.on('error', () => {
    observer.complete();
  });

  client.on('data', (data) => {
    buffer.push(data);
  });

  client.on('close', () => {
    if (buffer.length > 0) {
      observer.next([SmartBuffer.fromBuffer(Buffer.concat(buffer), 'utf8'), { address }]);
    }
    observer.complete();
  });

  client.connect(10001, address, () => {
    client.write(DISCOVERY_PACKET);
  });

  return () => {
    client.destroy();
  };
});

module.exports = (addressList, timeout = 500) => addressList
  .toObservable()
  .mergeMap(address => tcpDiscoveryRequest(address).takeUntil(Observable.timer(timeout)), nthArg(1), 100);
