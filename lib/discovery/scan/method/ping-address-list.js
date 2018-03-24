'use strict';

const { Observable } = require('rxjs/Rx');
const { isNil, curry, nthArg } = require('ramda');
const ping = require('net-ping');

const pingHost = curry((session, address) => Observable.create((observer) => {
  session.pingHost(address, (error) => {
    if (isNil(error)) {
      observer.next(address);
    }
    observer.complete();
  });
}));

module.exports = (addressList) => {
  const session = ping.createSession({
    networkProtocol: ping.NetworkProtocol.IPv4,
    packetSize: 16,
    retries: 0,
    timeout: 400,
    ttl: 120,
  });

  return addressList
    .toObservable()
    .concatMap(address => Observable.timer(1).mapTo(address))
    .mergeMap(pingHost(session), nthArg(1), 1000);
};
