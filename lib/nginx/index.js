'use strict';

const { Reader: reader } = require('monet');
const { isNil, merge, path } = require('ramda');
const moment = require('moment-timezone');

const { resolveP } = require('../util');

const updateSelfSignedOrUserCert = domain => reader(
  ({ config, requestPromise, logging }) => requestPromise({
    method: 'GET',
    uri: `http://${config.nginxHost}:${config.nginxPort}/cert`,
    qs: { domain },
    proxy: false, // ignore proxy env variables for this request
  })
    .then(() => logging.info(`Self-signed SSL cert for '${domain}' updated successfully`))
);

const updateLetsEncryptCert = domain => reader(
  ({ config, requestPromise, logging }) => requestPromise({
    method: 'GET',
    uri: `http://${config.nginxHost}:${config.nginxPort}/letsencrypt`,
    qs: { domain },
    proxy: false, // ignore proxy env variables for this request
  })
    .then(() => logging.info(`LetsEncrypt SSL cert for '${domain}' updated successfully`))
);

// useLetsEncrypt
// true = yes
// false = no
// null = use if previous attempt succeeded
const updateSslCertificate = (useLetsEncrypt, utcTime = moment.utc().valueOf()) => reader(
  ({ DB, config, logging, eventLog, requestPromise }) => (
      resolveP()
        .then(DB.nms.get)
        .then(nms => (useLetsEncrypt === null ? nms : merge(nms, { useLetsEncrypt })))
        .then((nms) => {
          if (isNil(nms.hostname)) {
            logging.info('No hostname set, will not update Nginx SSL certificate.');
            return nms;
          }

          return resolveP(logging.info(`Updating SSL certificate on Nginx for hostname ${nms.hostname}`))
            .then(() => updateSelfSignedOrUserCert(nms.hostname).run({ config, requestPromise, logging }))
            .then(() => (nms.useLetsEncrypt && !config.useCustomSslCert
              ? updateLetsEncryptCert(nms.hostname).run({ config, requestPromise, logging })
              : null))
            .then(() => merge(nms, {
              useLetsEncrypt: nms.useLetsEncrypt,
              letsEncryptError: useLetsEncrypt !== null ? null : nms.letsEncryptError,
              letsEncryptTimestamp: nms.useLetsEncrypt === true ? utcTime : nms.letsEncryptTimestamp,
            }))
            .catch((err) => {
              logging.error('SSL cert update failed', err);
              const errorMessage = path(['message'], err) || path(['error', 'message'], err) || 'Unknown error';
              eventLog.logSslCertError(moment.utc(utcTime).local().valueOf());
              return merge(nms, {
                useLetsEncrypt: false,
                letsEncryptError: errorMessage,
                letsEncryptTimestamp: utcTime,
              });
            });
        })
        .then(DB.nms.update)
        .catch((err) => {
          logging.error('Failed to update SSL certificate on Nginx', err);
        })
  )
);

module.exports = {
  updateSslCertificate,
};
