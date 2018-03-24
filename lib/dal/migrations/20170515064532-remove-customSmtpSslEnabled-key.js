'use strict';

const { assocPath, dissocPath, equals } = require('ramda');
const { getOr } = require('lodash/fp');

const { DB } = require('../../db');
const { allP, tapP } = require('../../util');


const backupCustomSmtpSslEnabledValue = nms =>
  DB.redis.setAsync('customSmtpSslEnabledBackup', getOr('true', ['smtp', 'customSmtpSslEnabled'], nms));


module.exports = {
  up() {
    return DB.nms.get()
      .then(tapP(backupCustomSmtpSslEnabledValue))
      .then(dissocPath(['smtp', 'customSmtpSslEnabled']))
      .then(DB.nms.update)
    ;
  },
  down() {
    const nmsPromise = DB.nms.get();
    const customSmtpSslEnabledBackupPromise = DB.redis.getAsync('customSmtpSslEnabledBackup').then(equals('true'));

    return allP([nmsPromise, customSmtpSslEnabledBackupPromise])
      .then(([nms, customSmtpSslEnabled]) => assocPath(['smtp', 'customSmtpSslEnabled'], customSmtpSslEnabled, nms))
      .then(DB.nms.update)
    ;
  },
};
