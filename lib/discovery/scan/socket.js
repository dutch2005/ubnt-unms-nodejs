'use strict';

const dgram = require('dgram');
const { Observable } = require('rxjs/Rx');
const { curry } = require('lodash/fp');
const { SmartBuffer } = require('smart-buffer');

const { error: logError } = require('../../logging');
const { UDP_PORT, DISCOVERY_PACKET } = require('../utils');

/**
 * @param {number} port
 * @return {Observable}
 */
const createSocket = (port = 0) => Observable.create((observer) => {
  const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  udpSocket.on('error', (err) => {
    observer.error(err);
    udpSocket.close();
  });

  udpSocket.on('close', () => { observer.complete() });

  udpSocket.on('listening', () => {
    observer.next(udpSocket);
    observer.complete();
  });

  udpSocket.bind(port);

  return () => {
    udpSocket.close();
  };
});

/**
 * @param {dgram.Socket} socket
 * @return {Observable}
 */
const listenToMessages = socket => Observable.create((observer) => {
  const listener = (buff, info) => {
    observer.next([SmartBuffer.fromBuffer(buff, 'utf8'), info]);
  };

  socket.on('message', listener);

  return () => {
    socket.removeListener('message', listener);
  };
});

/**
 * @param {dgram.Socket} socket
 * @param {string} address
 * @return {Observable}
 */
const sendDiscoveryPacket = curry((socket, address) => Observable.bindNodeCallback(socket.send)
  .call(socket, DISCOVERY_PACKET, 0, 4, UDP_PORT, address)
  .catch((err) => {
    logError('Sending discovery packet has failed', err);
    return Observable.empty(); // ignore the error
  })
);

module.exports = { createSocket, sendDiscoveryPacket, listenToMessages };
