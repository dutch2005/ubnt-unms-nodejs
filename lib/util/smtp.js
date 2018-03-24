'use strict';

const boom = require('boom');
const { overEvery, overSome, curry, includes, __, partial } = require('lodash/fp');
const { test, pathEq, pathSatisfies } = require('ramda');

const { log } = require('../logging');
const { configureAndVerifySmtp } = require('../mail');
const { resolveP } = require('../util');


const NODEJS_CA_ERROR_CODES = [
  'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_CRL', 'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE', 'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY', 'CERT_SIGNATURE_FAILURE',
  'CRL_SIGNATURE_FAILURE', 'CERT_NOT_YET_VALID', 'CERT_HAS_EXPIRED', 'CRL_NOT_YET_VALID', 'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD', 'ERROR_IN_CERT_NOT_AFTER_FIELD', 'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD', 'OUT_OF_MEM', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_CHAIN_TOO_LONG', 'CERT_REVOKED',
  'INVALID_CA', 'PATH_LENGTH_EXCEEDED', 'INVALID_PURPOSE', 'CERT_UNTRUSTED', 'CERT_REJECTED',
];

const GMAIL_SMTP_BAD_AUTH_RESPONSE = 'Username and Password not accepted';
const SMTP_BAD_AUTH_RESPONSE = 'Incorrect authentication data | authentication failure';

const badSmtpAuthRE = new RegExp(`(${GMAIL_SMTP_BAD_AUTH_RESPONSE}|${SMTP_BAD_AUTH_RESPONSE})`);
const badSmtpSslRE = new RegExp('SSL23_GET_SERVER_HELLO');
const isAuthMissingRE = new RegExp('Relay access denied');
const isAuthNotAllowedRE = new RegExp('authentication not enabled');
const isSelfSignedCertificateMessageRE = new RegExp('self signed certificate');
const isSelfSignedCertificateReasonRE = new RegExp('host.+is not in the cert\'s altnames');

const getErrMessage = (type, hint) => `SMTP ${type} failure${hint ? ` (${hint})` : ''}.`;

const getCredentialsErrMessage = partial(getErrMessage, ['credentials']);

const getConnectionErrMessage = partial(getErrMessage, ['connection']);

// isNodejsCAError :: ErrorCode -> Boolean
//     ErrorCode = String
const isNodejsCAError = pathSatisfies(includes(__, NODEJS_CA_ERROR_CODES), ['code']);

const isSelfSignedCertificateError = overSome([
  isNodejsCAError,
  pathSatisfies(test(isSelfSignedCertificateMessageRE), ['message']),
  pathSatisfies(test(isSelfSignedCertificateReasonRE), ['reason']),
]);

const isSmtpAuthError = overEvery([
  pathEq(['responseCode'], 535),
  pathSatisfies(test(badSmtpAuthRE), ['response']),
]);

const isSmtpSslError = overEvery([
  pathEq(['code'], 'ECONNECTION'),
  pathSatisfies(test(badSmtpSslRE), ['message']),
]);

const isAuthMissingError = overEvery([
  pathEq(['responseCode'], 454),
  pathSatisfies(test(isAuthMissingRE), ['response']),
]);

const isAuthNotAllowedError = overEvery([
  pathEq(['responseCode'], 503),
  pathSatisfies(test(isAuthNotAllowedRE), ['response']),
]);

const isBadPortError = pathEq(['errno'], 'ECONNREFUSED');

const isBadHostError = pathEq(['errno'], 'ENOTFOUND');


const handleSmtpError = curry((smtpSettings, error) => {
  let message = 'There was a SMTP error.';

  if (isSmtpAuthError(error)) { message = getCredentialsErrMessage() }
  if (isSmtpSslError(error)) { message = getConnectionErrMessage('SSL/TLS settings') }
  if (isSelfSignedCertificateError(error)) { message = getConnectionErrMessage('try allowing self-signed certificate') }
  if (isAuthMissingError(error)) { message = getCredentialsErrMessage('authentication required') }
  if (isAuthNotAllowedError(error)) { message = getCredentialsErrMessage('plain text with authentication') }
  if (isBadPortError(error)) { message = getConnectionErrMessage('port') }
  if (isBadHostError(error)) { message = getConnectionErrMessage('hostname') }

  log('error', { error, message, smtpSettings });
  throw boom.badData(message);
});

// testSmtpAuthSettings :: Object -> Promise
const testSmtpAuthSettings = smtpSettings => resolveP(smtpSettings)
  .then(configureAndVerifySmtp)
  .catch(handleSmtpError(smtpSettings));

module.exports = {
  handleSmtpError,
  isSmtpAuthError,
  isSmtpSslError,
  testSmtpAuthSettings,
};
