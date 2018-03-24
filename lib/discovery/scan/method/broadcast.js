'use strict';

const { Observable } = require('rxjs/Rx');

const { createSocket, listenToMessages, sendDiscoveryPacket } = require('../socket');
const { UDP_PORT } = require('../../utils');

const broadcastAddress = '255.255.255.255';
const multicastAddress = '233.89.188.1';

const createBroadcastSocket = (address, port = 0, multicast = false) =>
  createSocket(port)
    .switchMap((socket) => {
      // configure socket
      socket.setBroadcast(true);
      if (multicast) {
        socket.addMembership(address);
      }

      const messages$ = listenToMessages(socket);
      const send$ = sendDiscoveryPacket(socket, address).ignoreElements(); // send but ignore all

      return Observable.merge(
        messages$,
        send$
      );
    });

module.exports = scanTimeout => Observable.merge(
  createBroadcastSocket(broadcastAddress, UDP_PORT, false),
  createBroadcastSocket(broadcastAddress, 0, false),
  createBroadcastSocket(multicastAddress, 0, true)
).takeUntil(Observable.timer(scanTimeout));
