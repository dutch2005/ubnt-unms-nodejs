'use strict';

const crypto = require('crypto');
const { isUndefined } = require('lodash/fp');

const VERSION = '1.0';
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_ENCODING = 'hex';
const DECRYPTION_ENCODING = 'utf8';

const AES_KEY_LENGTH = 24;
const IV_LENGTH = 12;

// TODO(michal.sedlak@ubnt.com): Could be static class
class ProtocolV1 {
  get iv() {
    return this.masterAesKeyAccessor()
      .slice(AES_KEY_LENGTH, AES_KEY_LENGTH + IV_LENGTH)
      .toString('base64');
  }

  get aesKey() {
    return this.masterAesKeyAccessor()
      .slice(0, AES_KEY_LENGTH)
      .toString('base64');
  }

  constructor(masterAesKeyAccessor) {
    this.masterAesKeyAccessor = masterAesKeyAccessor;
  }

  handleIncoming(messageEvent) {
    const key = this.aesKey;
    const iv = this.iv;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      .setAutoPadding(false);

    const payload = Buffer.concat([
      decipher.update(messageEvent, ENCRYPTION_ENCODING),
      decipher.final(),
    ]).toString(DECRYPTION_ENCODING)
      // TODO(michal.sedlak@ubnt.com): Not sure why this is here
      .replace(/[\u0000-\u0019]+/g, '');

    return { payload, meta: { key, iv } };
  }

  handleOutgoing(message) {
    const key = isUndefined(message.meta.key) ? this.aesKey : message.meta.key;
    const iv = isUndefined(message.meta.iv) ? this.iv : message.meta.iv;
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const payload = message.payload;
    return Buffer.concat([
      cipher.update(payload, DECRYPTION_ENCODING),
      cipher.final(),
    ]).toString(ENCRYPTION_ENCODING);
  }
}

ProtocolV1.VERSION = VERSION;

module.exports = ProtocolV1;
