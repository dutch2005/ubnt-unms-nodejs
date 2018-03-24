'use strict';

const { merge, assoc } = require('ramda');


// mergeSmtpSettings :: (ApiSmtpSettings, CmNms) -> CmNms
//    ApiSmtpSettings = Object
//    CmNms = Object
const mergeSmtpSettings = (cmNms, apiSmtpSettings) => assoc('smtp',
  merge(cmNms.smtp, {
    customSmtpAuthEnabled: apiSmtpSettings.customSmtpAuthEnabled,
    customSmtpHostname: apiSmtpSettings.customSmtpHostname,
    customSmtpPassword: apiSmtpSettings.customSmtpPassword,
    customSmtpPort: apiSmtpSettings.customSmtpPort,
    customSmtpSecurityMode: apiSmtpSettings.customSmtpSecurityMode,
    customSmtpSender: apiSmtpSettings.customSmtpSender,
    customSmtpUsername: apiSmtpSettings.customSmtpUsername,
    gmailPassword: apiSmtpSettings.gmailPassword,
    gmailUsername: apiSmtpSettings.gmailUsername,
    tlsAllowUnauthorized: apiSmtpSettings.tlsAllowUnauthorized,
    type: apiSmtpSettings.type,
  }),
cmNms);

// mergeNmsSettings :: (ApiNmsSettings, CmNms) -> CmNms
//    ApiNmsSettings = Object
//    CmNms = Object
const mergeNmsSettings = (cmNms, apiNmsSettings) => merge(cmNms, {
  allowLoggingToLogentries: apiNmsSettings.allowLoggingToLogentries,
  allowLoggingToSentry: apiNmsSettings.allowLoggingToSentry,
  allowSelfSignedCertificate: apiNmsSettings.allowSelfSignedCertificate,
  autoBackups: apiNmsSettings.autoBackups,
  devicePingAddress: apiNmsSettings.devicePingAddress,
  devicePingIntervalNormal: apiNmsSettings.devicePingIntervalNormal,
  devicePingIntervalOutage: apiNmsSettings.devicePingIntervalOutage,
  deviceTransmissionProfile: apiNmsSettings.deviceTransmissionProfile,
  maps: apiNmsSettings.maps,
  hostname: apiNmsSettings.hostname,
  useLetsEncrypt: apiNmsSettings.useLetsEncrypt,
  timezone: apiNmsSettings.timezone,
  outages: apiNmsSettings.outages,
  locale: apiNmsSettings.locale,
  firmwares: {
    allowAutoUpdateUbntFirmwares: apiNmsSettings.firmwares.allowAutoUpdateUbntFirmwares,
  },
});

// mergeFirmwaresUnreadCount :: (FirmwaresUnreadCount, cmNmsSummary) -> cmNmsSummary
//    FirmwaresUnreadCount = Object
//    cmNmsSummary = Object
const mergeFirmwaresUnreadCount = (cmNmsSummary, firmwaresUnreadCount) => merge(cmNmsSummary, firmwaresUnreadCount);


module.exports = {
  mergeSmtpSettings,
  mergeNmsSettings,
  mergeFirmwaresUnreadCount,
};
