'use strict';

const { Observable } = require('rxjs/Rx');
const aguid = require('aguid');
const crypto = require('crypto');
const { padCharsStart, times, isUndefined } = require('lodash/fp');
const { both, pathEq } = require('ramda');
const uuid = require('uuid');
const base64url = require('base64-url');

const { InvalidMessageError, DecryptionFailedError } = require('../errors');
const { MessageNameEnum, MessageTypeEnum } = require('../../transformers/socket/enums');
const { parseConnectMessageReply } = require('../transformers/parsers');
const { MacAesKeyExchangeStatusEnum } = require('../../enums');
const { toMs } = require('../../util');

const VERSION = '2.0';
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_ENCODING = 'base64';
const DECRYPTION_ENCODING = 'utf8';

const AES_KEY_LENGTH = 32;
const IV_LENGTH = 22;
const AUTH_TAG_LENGTH = 22;
const MAC_LENGTH = 8;
const MIN_MESSAGE_LENGTH = IV_LENGTH + AUTH_TAG_LENGTH + MAC_LENGTH;

const ESTABLISH_CONNECTION_TIMEOUT = toMs('seconds', 30);

const isConnectMessage = both(
  pathEq(['name'], MessageNameEnum.Connect),
  pathEq(['type'], MessageTypeEnum.Event)
);

const bufferToMac = buff => times(i => padCharsStart('0', 2, buff.readUInt8(i).toString(16)), 6).join(':');

const sysInfoRequest = () => ({
  id: aguid(),
  type: MessageTypeEnum.Rpc,
  socket: 'sys',
  name: MessageNameEnum.GetSysInfo,
  request: { GETDATA: 'sys_info' },
  meta: {},
});

class ProtocolV2 {
  static parseMessage(message, expectConnectMessage = false) {
    const unescapedMessage = base64url.unescape(message);

    if (unescapedMessage.length <= MIN_MESSAGE_LENGTH) {
      throw new InvalidMessageError('Message too sort to be a valid message');
    }

    // slice base64 strings not buffers!
    const iv = Buffer.from(unescapedMessage.substr(0, IV_LENGTH), ENCRYPTION_ENCODING);
    const authTag = Buffer.from(unescapedMessage.substr(IV_LENGTH, AUTH_TAG_LENGTH), ENCRYPTION_ENCODING);

    let mac = null;
    let encryptedData = null;
    if (expectConnectMessage) { // connect message contains mac address
      mac = Buffer.from(unescapedMessage.substr(IV_LENGTH + AUTH_TAG_LENGTH, MAC_LENGTH), ENCRYPTION_ENCODING);
      encryptedData = Buffer.from(unescapedMessage.substr(MIN_MESSAGE_LENGTH), ENCRYPTION_ENCODING);
    } else {
      encryptedData = Buffer.from(unescapedMessage.substr(IV_LENGTH + AUTH_TAG_LENGTH), ENCRYPTION_ENCODING);
    }

    return { iv, authTag, mac, encryptedData };
  }

  get masterAesKey() {
    return this.masterAesKeyAccessor()
      .slice(0, AES_KEY_LENGTH);
  }

  get aesKey() {
    return this.macAesKey === null ? this.masterAesKey() : this.macAesKey.key;
  }

  constructor(macAesKeyStore, masterAesKeyAccessor, remoteAddress) {
    /** @type {MacAesKeyStore} */
    this.macAesKeyStore = macAesKeyStore;
    this.masterAesKeyAccessor = masterAesKeyAccessor;
    /** @type {MacAesKey|null} */
    this.macAesKey = null;
    /** @type {string|null} */
    this.mac = null; // used as device identification
    this.remoteAddress = remoteAddress;
  }

  sendKey(connection, connectMessage) {
    const payload = { key: this.macAesKey.key };
    const reply = parseConnectMessageReply(payload, connectMessage);
    return connection.send(reply)
      // eslint-disable-next-line max-len
      // see https://github.com/ubiquiti/ubnt-udapi-bridge/blob/c152a5fb56e155907ece38d7f3012744e49c3f9d/src/websocket.c#L238-L259
      .mergeMapTo(connection.rpc(sysInfoRequest())) // this will trigger AES key save
      .mergeMapTo(Observable.never()) // hold connection until device disconnects, meaning AES key is stored
      .takeUntil(connection.close$);
  }

  /**
   * @param {WebSocketConnection} connection
   * @return {Observable.<void>}
   */
  handleEstablish(connection) {
    return connection.messages$ // access messages
      .first(isConnectMessage)
      // attempt to do aes key exchange with the device
      .mergeMap((connectMessage) => {
        if (isUndefined(this.macAesKey)) {
          // create new aes key for device
          connection.log('Creating new AES key');
          return this.macAesKeyStore.create(this.mac, this.remoteAddress, connectMessage.model)
            .do((macAesKey) => { this.macAesKey = macAesKey }) // save AES key
            .mergeMap(() => {
              connection.log('Sending new AES key');
              return this.sendKey(connection, connectMessage);
            });
        } else if (this.macAesKey.exchangeStatus === MacAesKeyExchangeStatusEnum.Pending) {
          // send aes key for device again
          connection.log('AES key exchange pending, sending AES key again');
          return this.sendKey(connection, connectMessage);
        }

        return Observable.of(connectMessage);
      })
      .timeout(ESTABLISH_CONNECTION_TIMEOUT)
      .catch(error => connection.close(error))
      .take(1);
  }

  handleIncoming(socketMessage) {
    const expectConnectMessage = this.macAesKey === null; // mac address will come as part of the first message
    const parsedMessage = ProtocolV2.parseMessage(socketMessage, expectConnectMessage);
    const { iv, authTag, mac, encryptedData } = parsedMessage;

    if (expectConnectMessage) {
      const macAddressString = bufferToMac(mac);
      this.mac = macAddressString;
      this.macAesKey = this.macAesKeyStore.findByMac(macAddressString);

      // no device key, we try to use masterKey
      if (isUndefined(this.macAesKey)) {
        // decrypt with master key, this will throw if key is invalid
        return this.decrypt(encryptedData, this.masterAesKey, iv, authTag, mac);
      }
    }

    let decryptedMessage = null;

    try {
      decryptedMessage = this.decrypt(encryptedData, this.macAesKey.key, iv, authTag, mac);

      if (this.macAesKey.exchangeStatus === MacAesKeyExchangeStatusEnum.Pending) {
        return this.macAesKeyStore.updateStatus(this.mac, MacAesKeyExchangeStatusEnum.Complete)
          .do((macAesKey) => { this.macAesKey = macAesKey })
          .mapTo(decryptedMessage);
      }
    } catch (error) {
      // re throw if not expecting connect message or error is not decryption or exchange is not pending
      if (expectConnectMessage &&
        error instanceof DecryptionFailedError &&
        this.macAesKey.exchangeStatus === MacAesKeyExchangeStatusEnum.Pending) {
        // decryption failed, but exchange is pending, try masterKey again
        decryptedMessage = this.decrypt(encryptedData, this.masterAesKey, iv, authTag, mac);
      } else {
        throw error;
      }
    }

    return decryptedMessage;
  }

  handleOutgoing(message) {
    const key = isUndefined(message.meta.key) ? this.aesKey : message.meta.key;

    return this.encrypt(message.payload, key);
  }

  /**
   * @param {Buffer} encryptedData
   * @param {Buffer} key
   * @param {Buffer} iv
   * @param {Buffer} authTag
   * @param {Buffer} [aad]
   * @return {Object}
   */
  decrypt(encryptedData, key, iv, authTag, aad = null) {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      .setAutoPadding(false)
      .setAuthTag(authTag);

    if (aad !== null) {
      decipher.setAAD(aad);
    }

    let payload = null;
    try {
      payload = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]).toString(DECRYPTION_ENCODING)
      // TODO(michal.sedlak@ubnt.com): Not sure why this is here
        .replace(/[\u0000-\u0019]+/g, '');
    } catch (e) {
      throw new DecryptionFailedError(this.mac, this.remoteAddress);
    }

    return {
      payload,
      meta: { key, iv, authTag, aad, mac: this.mac },
    };
  }

  /**
   * @param {string} message
   * @param {Buffer} aesKey
   * @return {string}
   */
  encrypt(message, aesKey) { // eslint-disable-line class-methods-use-this
    const iv = uuid.v4(null, Buffer.alloc(16), 0);

    const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);

    const encryptedData = cipher.update(message, DECRYPTION_ENCODING, ENCRYPTION_ENCODING)
      + cipher.final(ENCRYPTION_ENCODING);

    // concat ENCRYPTION_ENCODING strings not buffers !!
    const payload = iv.toString(ENCRYPTION_ENCODING)
      + cipher.getAuthTag().toString(ENCRYPTION_ENCODING)
      + encryptedData;

    return base64url.escape(payload);
  }
}

ProtocolV2.VERSION = VERSION;

module.exports = ProtocolV2;
