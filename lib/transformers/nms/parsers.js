'use strict';

const { pathOr } = require('ramda');

const { liftParser } = require('../index');


// parseDbNms :: (Auxiliaries, DbNms) -> NmsCorrespondenceData
//    Auxiliaries = Object
//    DbNms = Object
//    NmsCorrespondenceData = Object
const parseDbNms = (auxiliaries, dbNms) => ({
  id: dbNms.id,
  isConfigured: dbNms.isConfigured,
  instanceId: dbNms.instanceId,
  aesKey: dbNms.aesKey,
  autoBackups: dbNms.autoBackups,
  smtp: {
    type: dbNms.smtp.type,
    tlsAllowUnauthorized: dbNms.smtp.tlsAllowUnauthorized,
    customSmtpAuthEnabled: dbNms.smtp.customSmtpAuthEnabled,
    customSmtpHostname: dbNms.smtp.customSmtpHostname,
    customSmtpPort: dbNms.smtp.customSmtpPort,
    customSmtpUsername: dbNms.smtp.customSmtpUsername,
    customSmtpPassword: dbNms.smtp.customSmtpPassword,
    customSmtpSender: dbNms.smtp.customSmtpSender,
    gmailPassword: dbNms.smtp.gmailPassword,
    gmailUsername: dbNms.smtp.gmailUsername,
    customSmtpSecurityMode: dbNms.smtp.customSmtpSecurityMode,
  },
  deviceLog: dbNms.deviceLog,
  devicePingAddress: dbNms.devicePingAddress,
  devicePingIntervalNormal: dbNms.devicePingIntervalNormal,
  devicePingIntervalOutage: dbNms.devicePingIntervalOutage,
  deviceTransmissionProfile: dbNms.deviceTransmissionProfile,
  allowLoggingToSentry: dbNms.allowLoggingToSentry,
  allowLoggingToLogentries: dbNms.allowLoggingToLogentries,
  allowSelfSignedCertificate: dbNms.allowSelfSignedCertificate,
  maps: dbNms.maps,
  hostname: dbNms.hostname,
  useLetsEncrypt: dbNms.useLetsEncrypt,
  letsEncryptError: dbNms.letsEncryptError,
  letsEncryptTimestamp: dbNms.letsEncryptTimestamp,
  timezone: dbNms.timezone,
  outages: dbNms.outages,
  locale: dbNms.locale,
  firmwares: {
    allowAutoUpdateUbntFirmwares: pathOr(null, ['firmwares', 'allowAutoUpdateUbntFirmwares'], dbNms),
  },
});

// parseDbNmsSummary :: (Auxiliaries, DbNmsSummary) -> NmsSummaryCorrespondenceData
//    Auxiliaries = Object
//    DbNmsSummary = Object
//    NmsSummaryCorrespondenceData = Object
const parseDbNmsSummary = (auxiliaries, dbNmsSummary) => ({
  logsUnreadCount: dbNmsSummary.logsUnreadCount,
  outagesUnreadCount: dbNmsSummary.outagesUnreadCount,
  devicesUnauthorizedCount: dbNmsSummary.devicesUnauthorizedCount,
  firmwareUnreadCount: null,
});


// parseDbNmsSettings :: (Auxiliaries, DbNmsSettings) -> NmsSettingsCorrespondenceData
//    Auxiliaries = Object
//    DbNmsSettings = Object
//    NmsSettingsCorrespondenceData = Object
const parseDbNmsSettings = (auxiliaries, dbNmsSettings) => ({
  timezone: dbNmsSettings.timezone,
  hostname: dbNmsSettings.hostname,
  useLetsEncrypt: dbNmsSettings.useLetsEncrypt,
  letsEncryptError: dbNmsSettings.letsEncryptError,
  letsEncryptTimestamp: dbNmsSettings.letsEncryptTimestamp,
  autoBackups: dbNmsSettings.autoBackups,
  maps: {
    provider: dbNmsSettings.mapsProvider,
    googleMapsApiKey: dbNmsSettings.googleMapsApiKey,
  },
  devicePingAddress: dbNmsSettings.devicePingAddress,
  devicePingIntervalNormal: dbNmsSettings.devicePingIntervalNormal,
  devicePingIntervalOutage: dbNmsSettings.devicePingIntervalOutage,
  allowLoggingToSentry: dbNmsSettings.allowLoggingToSentry,
  allowLoggingToLogentries: dbNmsSettings.allowLoggingToLogentries,
  deviceTransmissionProfile: dbNmsSettings.deviceTransmissionProfile,
  allowSelfSignedCertificate: dbNmsSettings.allowSelfSignedCertificate,
  outages: dbNmsSettings.outages,
  deviceLog: dbNmsSettings.deviceLog,
  instanceId: dbNmsSettings.instanceId,
  connectionString: dbNmsSettings.connectionString,
  aesKey: dbNmsSettings.aesKey,
  locale: dbNmsSettings.locale,
  firmwares: {
    allowAutoUpdateUbntFirmwares: pathOr(null, ['firmwares', 'allowAutoUpdateUbntFirmwares'], dbNmsSettings),
  },
});


/*
 * Api Parsing
 */

// parseApiNmsSettings :: (Auxiliaries, ApiNmsSettings) -> NmsSettingsCorrespondenceData
//    Auxiliaries = Object
//    ApiNmsSettings = Object
//    NmsSettingsCorrespondenceData = Object
const parseApiNmsSettings = (auxiliaries, apiNmsSettings) => ({
  timezone: apiNmsSettings.timezone,
  hostname: apiNmsSettings.hostname,
  useLetsEncrypt: apiNmsSettings.useLetsEncrypt,
  autoBackups: apiNmsSettings.autoBackups,
  maps: {
    provider: apiNmsSettings.mapsProvider,
    googleMapsApiKey: apiNmsSettings.googleMapsApiKey,
  },
  devicePingAddress: apiNmsSettings.devicePingAddress,
  devicePingIntervalNormal: apiNmsSettings.devicePingIntervalNormal,
  devicePingIntervalOutage: apiNmsSettings.devicePingIntervalOutage,
  allowLoggingToSentry: apiNmsSettings.allowLoggingToSentry,
  allowLoggingToLogentries: apiNmsSettings.allowLoggingToLogentries,
  deviceTransmissionProfile: apiNmsSettings.deviceTransmissionProfile,
  allowSelfSignedCertificate: apiNmsSettings.allowSelfSignedCertificate,
  outages: {
    defaultGracePeriod: apiNmsSettings.defaultGracePeriod,
    restartGracePeriod: apiNmsSettings.restartGracePeriod,
    upgradeGracePeriod: apiNmsSettings.upgradeGracePeriod,
  },
  locale: {
    longDateFormat: {
      LT: apiNmsSettings.timeFormat,
      LL: apiNmsSettings.dateFormat,
    },
  },
  firmwares: {
    allowAutoUpdateUbntFirmwares: apiNmsSettings.allowAutoUpdateUbntFirmwares,
  },
});

// parseApiSmtp :: (Auxiliaries, ApiSmtp) -> SmtpCorrespondenceData
//    Auxiliaries = Object
//    ApiSmtp = Object
//    SmtpCorrespondenceData = Object
const parseApiSmtp = (auxiliaries, apiSmtp) => ({
  customSmtpAuthEnabled: apiSmtp.customSmtpAuthEnabled,
  customSmtpHostname: apiSmtp.customSmtpHostname,
  customSmtpPassword: apiSmtp.customSmtpPassword,
  customSmtpPort: apiSmtp.customSmtpPort,
  customSmtpSecurityMode: apiSmtp.customSmtpSecurityMode,
  customSmtpSender: apiSmtp.customSmtpSender,
  customSmtpUsername: apiSmtp.customSmtpUsername,
  gmailPassword: apiSmtp.gmailPassword,
  gmailUsername: apiSmtp.gmailUsername,
  tlsAllowUnauthorized: apiSmtp.tlsAllowUnauthorized,
  type: apiSmtp.type,
});


module.exports = {
  parseDbNmsSummary,
  parseDbNms,
  parseDbNmsSettings,

  parseApiSmtp,
  parseApiNmsSettings,

  safeParseDbNmsSummary: liftParser(parseDbNmsSummary),
  safeParseDbNms: liftParser(parseDbNms),
  safeParseDbNmsSettings: liftParser(parseDbNmsSettings),

  safeParseApiSmtp: liftParser(parseApiSmtp),
  safeParseApiNmsSettings: liftParser(parseApiNmsSettings),
};
