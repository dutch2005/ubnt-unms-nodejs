'use strict';

const { assocPath, dissocPath, equals } = require('ramda');
const { getOr } = require('lodash/fp');

const { DB } = require('../../db');
const { allP, tapP } = require('../../util');

// TODO(michal.sedlak@ubnt.com): Remove this backup
const backupAllowSelfSignedCertificate = nms =>
  DB.redis.setAsync('allowSelfSignedCertificateBackup', getOr('false', ['allowSelfSignedCertificate'], nms));


module.exports = {
  up() {
    return DB.nms.get()
      .then(tapP(backupAllowSelfSignedCertificate))
      .then(dissocPath(['allowSelfSignedCertificate']))
      .then(DB.nms.update);
  },
  down() {
    const nmsPromise = DB.nms.get();
    const allowSelfSignedCertificateBackupPromise = DB.redis.getAsync('allowSelfSignedCertificateBackup')
      .then(equals('true'));

    return allP([nmsPromise, allowSelfSignedCertificateBackupPromise])
      .then(([nms, allowSelfSignedCertificate]) =>
        assocPath(['allowSelfSignedCertificate'], allowSelfSignedCertificate, nms)
      )
      .then(DB.nms.update);
  },
};
