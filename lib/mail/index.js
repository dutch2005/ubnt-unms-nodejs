'use strict';

const path = require('path');
const nodemailer = require('nodemailer');
const { invoke, pickBy } = require('lodash/fp');
const { EmailTemplate } = require('email-templates');
const { memoize, flow, curry, isObject } = require('lodash');
const { assoc, merge } = require('ramda');

const { isNotUndefined } = require('../util');
const { MailServerTypeEnum, SmtpSecurityModeEnum } = require('../enums');
const config = require('../../config');


const createSmtpConfig = (host, port, connectionTimeout, securityMode) => {
  const smtpConfig = { secure: false };
  switch (securityMode) {
    case SmtpSecurityModeEnum.SSL:
      smtpConfig.secure = true;
      break;
    case SmtpSecurityModeEnum.TLS:
      smtpConfig.requireTLS = true;
      break;
    case SmtpSecurityModeEnum.PlainText:
      smtpConfig.ignoreTLS = true;
      break;
    default: break;
  }
  return merge(smtpConfig, pickBy(isNotUndefined, { host, port, connectionTimeout }));
};
const createGmailTransporter = ({ gmailUsername: user, gmailPassword: pass }) =>
  nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

const createSmtpTransporter = ({
  connectionTimeout,
  tlsAllowUnauthorized,
  customSmtpHostname: host,
  customSmtpPort: port,
  customSmtpAuthEnabled: auth,
  customSmtpUsername: user,
  customSmtpPassword: pass,
  customSmtpSender: sender,
  customSmtpSecurityMode: securityMode,
}) => {
  const rejectUnauthorized = !tlsAllowUnauthorized;
  const smtpConfig = createSmtpConfig(host, port, connectionTimeout, securityMode);
  const authentication = auth ? { auth: { user, pass } } : {};
  const tls = { tls: { rejectUnauthorized } };
  const transporter = nodemailer.createTransport(Object.assign({}, smtpConfig, authentication, tls));
  transporter.defaultMessageData = sender ? { from: sender, sender } : {};

  return transporter;
};

const createDefaultTransporter = () => createSmtpTransporter({
  connectionTimeout: config.cloudSettings.smtpTimeout,
  tlsAllowUnauthorized: config.cloudSettings.smtpTlsAllowUnauthorized,
  customSmtpHostname: config.cloudSettings.smtpHostname,
  customSmtpPort: config.cloudSettings.smtpPort,
  customSmtpAuthEnabled: config.cloudSettings.cloudEnabled,
  customSmtpUsername: config.cloudSettings.smtpUsername,
  customSmtpPassword: config.cloudSettings.smtpPassword,
  customSmtpSender: config.cloudSettings.smtpSender,
  customSmtpSecurityMode: config.cloudSettings.smtpSecurityMode,
});

const createDummyTransporter = memoize(() =>
  nodemailer.createTransport({
    name: 'minimal',
    version: '0.1.0',
    send(mail, callback) {
      const input = mail.message.createReadStream();
      input.pipe(process.stdout);
      input.on('end', () => callback(null, true));
    },
  })
);

const createTransporter = (smtpSettings) => {
  switch (smtpSettings.type) {
    case MailServerTypeEnum.Cloud: return createDefaultTransporter();
    case MailServerTypeEnum.Gmail: return createGmailTransporter(smtpSettings);
    case MailServerTypeEnum.Smtp: return createSmtpTransporter(smtpSettings);
    default: return createDummyTransporter();
  }
};

const createTransporterForVerification = smtpSettings => (
  // the default SMTP must always pass verification because the user
  // should be able to select it even when it doesn't work at that moment
  smtpSettings.type === MailServerTypeEnum.Cloud
    ? createDummyTransporter()
    : createTransporter(smtpSettings)
);

// decorateWithConnectionTimeout :: Number -> Object -> Object
const decorateWithConnectionTimeout = assoc('connectionTimeout');

/*
 * Template processing
 */
const createTemplateSender = curry((templateName, transporter) => {
  const defaults = {};
  const templatePath = path.join(__dirname, 'templates', templateName);

  if (isObject(transporter.defaultMessageData)) {
    Object.assign(defaults, transporter.defaultMessageData);
  }

  return transporter.templateSender(new EmailTemplate(templatePath), defaults);
});

const configureAndVerifySmtp = flow(
  decorateWithConnectionTimeout(10000), createTransporterForVerification, invoke('verify')
);
const configureAndSendTest = flow(createTransporter, createTemplateSender('test'));
const configureAndSendAdminInvite = flow(createTransporter, createTemplateSender('invite-admin'));
const configureAndSendAdminRevoke = flow(createTransporter, createTemplateSender('revoke-admin'));
const configureAndSendNewEmailNotification = flow(createTransporter, createTemplateSender('email-notif-new'));
const configureAndSendOldEmailNotification = flow(createTransporter, createTemplateSender('email-notif-old'));
const configureAndSendForgottenPasswordResetLink = flow(createTransporter, createTemplateSender('forgotten-password'));
const configureAndSendEventNotification = flow(createTransporter, createTemplateSender('event-notification'));


module.exports = {
  configureAndVerifySmtp,
  configureAndSendTest,
  configureAndSendAdminInvite,
  configureAndSendAdminRevoke,
  configureAndSendNewEmailNotification,
  configureAndSendOldEmailNotification,
  configureAndSendForgottenPasswordResetLink,
  configureAndSendEventNotification,
};
