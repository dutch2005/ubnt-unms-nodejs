'use strict';

const { liftMapper } = require('../index');

// toApiNmsSummary :: CmNmsSummary -> ApiNmsSummary
//     CmNmsSummary = Object
//     NmsSummary = Object
const toApiNmsSummary = correspondenceData => ({
  logsUnreadCount: correspondenceData.logsUnreadCount,
  outagesUnreadCount: correspondenceData.outagesUnreadCount,
  devicesUnauthorizedCount: correspondenceData.devicesUnauthorizedCount,
  firmwaresUnreadCount: correspondenceData.firmwaresUnreadCount,
});

// toApiSmtp :: NmsCorrenspondenceData -> ApiSmtp
//     NmsCorrenspondenceData = Object
//     ApiSmtp = Object
const toApiSmtp = cmNms => ({
  customSmtpAuthEnabled: cmNms.smtp.customSmtpAuthEnabled,
  customSmtpHostname: cmNms.smtp.customSmtpHostname,
  customSmtpPassword: cmNms.smtp.customSmtpPassword,
  customSmtpPort: cmNms.smtp.customSmtpPort,
  customSmtpSecurityMode: cmNms.smtp.customSmtpSecurityMode,
  customSmtpSender: cmNms.smtp.customSmtpSender,
  customSmtpUsername: cmNms.smtp.customSmtpUsername,
  gmailPassword: cmNms.smtp.gmailPassword,
  gmailUsername: cmNms.smtp.gmailUsername,
  tlsAllowUnauthorized: cmNms.smtp.tlsAllowUnauthorized,
  type: cmNms.smtp.type,
});

// toApiNmsSettings :: NmsSettingsCorrenspondenceData -> ApiNmsSettings
//     NmsSettingsCorrenspondenceData = Object
//     ApiNmsSettings = Object
const toApiNmsSettings = cmNmsSettings => ({
  timezone: cmNmsSettings.timezone,
  hostname: cmNmsSettings.hostname,
  useLetsEncrypt: cmNmsSettings.useLetsEncrypt,
  letsEncryptError: cmNmsSettings.letsEncryptError,
  letsEncryptTimestamp: cmNmsSettings.letsEncryptTimestamp,
  autoBackups: cmNmsSettings.autoBackups,
  mapsProvider: cmNmsSettings.maps.provider,
  googleMapsApiKey: cmNmsSettings.maps.googleMapsApiKey,
  devicePingAddress: cmNmsSettings.devicePingAddress,
  devicePingIntervalNormal: cmNmsSettings.devicePingIntervalNormal,
  devicePingIntervalOutage: cmNmsSettings.devicePingIntervalOutage,
  allowLoggingToSentry: cmNmsSettings.allowLoggingToSentry,
  allowLoggingToLogentries: cmNmsSettings.allowLoggingToLogentries,
  deviceTransmissionProfile: cmNmsSettings.deviceTransmissionProfile,
  allowSelfSignedCertificate: cmNmsSettings.allowSelfSignedCertificate,
  defaultGracePeriod: cmNmsSettings.outages.defaultGracePeriod,
  restartGracePeriod: cmNmsSettings.outages.restartGracePeriod,
  upgradeGracePeriod: cmNmsSettings.outages.upgradeGracePeriod,
  dateFormat: cmNmsSettings.locale.longDateFormat.LL,
  timeFormat: cmNmsSettings.locale.longDateFormat.LT,
  allowAutoUpdateUbntFirmwares: cmNmsSettings.firmwares.allowAutoUpdateUbntFirmwares,
});

// toDbNms :: NmsCorrenspondanceData -> DbNms
//    NmsCorrenspondanceData = Object
//    DbNms = Object
const toDbNms = cmNms => ({
  id: cmNms.id,
  isConfigured: cmNms.isConfigured,
  instanceId: cmNms.instanceId,
  aesKey: cmNms.aesKey,
  autoBackups: cmNms.autoBackups,
  smtp: {
    type: cmNms.smtp.type,
    tlsAllowUnauthorized: cmNms.smtp.tlsAllowUnauthorized,
    customSmtpAuthEnabled: cmNms.smtp.customSmtpAuthEnabled,
    customSmtpHostname: cmNms.smtp.customSmtpHostname,
    customSmtpPort: cmNms.smtp.customSmtpPort,
    customSmtpUsername: cmNms.smtp.customSmtpUsername,
    customSmtpPassword: cmNms.smtp.customSmtpPassword,
    customSmtpSender: cmNms.smtp.customSmtpSender,
    gmailPassword: cmNms.smtp.gmailPassword,
    gmailUsername: cmNms.smtp.gmailUsername,
    customSmtpSecurityMode: cmNms.smtp.customSmtpSecurityMode,
  },
  deviceLog: cmNms.deviceLog,
  devicePingAddress: cmNms.devicePingAddress,
  devicePingIntervalNormal: cmNms.devicePingIntervalNormal,
  devicePingIntervalOutage: cmNms.devicePingIntervalOutage,
  deviceTransmissionProfile: cmNms.deviceTransmissionProfile,
  allowLoggingToSentry: cmNms.allowLoggingToSentry,
  allowLoggingToLogentries: cmNms.allowLoggingToLogentries,
  allowSelfSignedCertificate: cmNms.allowSelfSignedCertificate,
  maps: cmNms.maps,
  hostname: cmNms.hostname,
  useLetsEncrypt: cmNms.useLetsEncrypt,
  letsEncryptError: cmNms.letsEncryptError,
  letsEncryptTimestamp: cmNms.letsEncryptTimestamp,
  timezone: cmNms.timezone,
  outages: cmNms.outages,
  locale: cmNms.locale,
  firmwares: cmNms.firmwares,
});


module.exports = {
  toApiNmsSummary,
  toApiSmtp,
  toApiNmsSettings,

  toDbNms,

  safeToApiNmsSummary: liftMapper(toApiNmsSummary),
  safeToApiSmtp: liftMapper(toApiSmtp),
  safeToApiNmsSettings: liftMapper(toApiNmsSettings),

  safeToDbNms: liftMapper(toDbNms),
};
