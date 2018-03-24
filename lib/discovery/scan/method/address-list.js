'use strict';

const { Observable } = require('rxjs/Rx');

const { createSocket, listenToMessages, sendDiscoveryPacket } = require('../socket');

module.exports = (addressList$, scanTimeout) => createSocket()
  .switchMap((socket) => {
    const messages$ = listenToMessages(socket);

    const send$ = addressList$
      // send packets one at a time
      .concatMap(sendDiscoveryPacket(socket))
      // only report error and complete
      .ignoreElements();

    return messages$
      // when everything is send, wait for scanTimeout and end scan
      .takeUntil(send$.concat(Observable.defer(() => Observable.timer(scanTimeout))));
  });
