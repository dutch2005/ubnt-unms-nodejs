'use strict';

const os = require('os');
const { Reader: reader } = require('monet');
const moment = require('moment-timezone');
const { tap, defaultTo } = require('lodash/fp');
const { pathOr, merge } = require('ramda');
const { isNotNull } = require('ramda-adjunct');

const config = require('../../config');

moment.defineLocale('unms', { parentLocale: 'en' });

// TODO(jaroslav.klima@ubnt.com): use store.js
const settings = {};

function mergeOutageSettings(appConfig, nmsConfig) {
  return Object.assign({}, appConfig, nmsConfig);
}

function mergeDeviceLogSettings(appConfig, nmsConfig) {
  const result = {};
  Object.keys(appConfig).forEach((propertyName) => {
    result[propertyName] = Object.assign({}, appConfig[propertyName], nmsConfig[propertyName]);
  });
  return result;
}

function mergeFirmwaresSettings(appConfig, nmsConfig) {
  return merge(appConfig, {
    allowAutoUpdateUbntFirmwares: pathOr(
      appConfig.allowAutoUpdateUbntFirmwares,
      ['allowAutoUpdateUbntFirmwares'],
      nmsConfig
    ),
  });
}

const loadSettings = () => reader(
  ({ DB }) => DB.nms.get()
    .then(tap(nms => moment.updateLocale('unms', nms.locale)))
    .then((nms) => {
      settings.isConfigured = nms.isConfigured;
      settings.outages = mergeOutageSettings(config.outages, nms.outages);
      settings.locale = nms.locale;
      settings.deviceLog = mergeDeviceLogSettings(config.deviceLog, nms.deviceLog);
      settings.useLetsEncrypt = nms.useLetsEncrypt;
      settings.letsEncryptError = nms.letsEncryptError;
      settings.letsEncryptTimestamp = nms.letsEncryptTimestamp;
      settings.allowLoggingToLogentries = nms.allowLoggingToLogentries;
      settings.allowLoggingToSentry = nms.allowLoggingToSentry;
      settings.instanceId = nms.instanceId;
      settings.hostname = nms.hostname || os.hostname();
      settings.connectionString = `wss://${settings.hostname}:${config.publicWsPort}+${nms.aesKey}`;
      settings.aesKey = Buffer.from(nms.aesKey, 'base64');
      settings.googleMapsApiKey = config.cloud ? config.cloudSettings.googleMapsApiKey : nms.maps.googleMapsApiKey;
      settings.mapsProvider = config.cloud ? config.cloudSettings.mapsProvider : nms.maps.provider;
      settings.autoBackups = nms.autoBackups;
      settings.devicePingAddress = defaultTo(settings.hostname, nms.devicePingAddress);
      settings.devicePingIntervalNormal = nms.devicePingIntervalNormal;
      settings.devicePingIntervalOutage = nms.devicePingIntervalOutage;
      settings.timezone = nms.timezone;
      settings.deviceTransmissionProfile = nms.deviceTransmissionProfile;
      settings.firmwares = mergeFirmwaresSettings(config.firmwares, nms.firmwares);
    })
);

const getSettings = () => settings;

const getOutageSettings = () => settings.outages;

const getDeviceLogSettings = () => settings.deviceLog;

const getInstanceId = () => settings.instanceId;

const isConfigured = () => settings.isConfigured;

const deviceTransmissionProfile = () => settings.deviceTransmissionProfile;

const allowLoggingToSentry = () =>
  isConfigured() && (config.isProduction || config.isTest) && settings.allowLoggingToSentry;

const allowLoggingToLogentries = () =>
  isConfigured() && (config.isProduction || config.isTest) && settings.allowLoggingToLogentries;

const connectionString = () => `${settings.connectionString}+allowSelfSignedCertificate`;

const unmsHostname = () => settings.hostname;

const unmsGuiUrl = () => {
  const portSuffix = config.publicHttpsPort === config.defaultHttpsPort ? '' : `:${config.publicHttpsPort}`;
  return `https://${settings.hostname}${portSuffix}`;
};

const firmwares = () => settings.firmwares;

const firmwaresGuiUrl = () => `${unmsGuiUrl()}/${settings.firmwares.publicDir}`;

const firmwaresWsUrl = () => {
  const portSuffix = config.publicWsPort === config.defaultHttpsPort ? '' : `:${config.publicWsPort}`;
  return `https://${settings.hostname}${portSuffix}/${settings.firmwares.publicDir}`;
};

const firmwaresPublicUrl = () => `/${settings.firmwares.publicDir}`;

const discoveryScanTimeout = () => config.discoveryScanTimeout;

const discoveryIpRangeMaxSize = () => config.discoveryIpRangeMaxSize;

const aesKey = () => settings.aesKey;

const aesIv = () => settings.aesIv;

const isLetsEncryptError = () => isNotNull(settings.letsEncryptError);

const secureLinkSecret = () => config.secureLinkSecret;

module.exports = {
  loadSettings,
  getSettings,
  getOutageSettings,
  getDeviceLogSettings,
  getInstanceId,
  deviceTransmissionProfile,
  allowLoggingToSentry,
  allowLoggingToLogentries,
  isConfigured,
  discoveryScanTimeout,
  discoveryIpRangeMaxSize,
  connectionString,
  unmsGuiUrl,
  firmwaresGuiUrl,
  firmwaresWsUrl,
  firmwaresPublicUrl,
  unmsHostname,
  aesKey,
  aesIv,
  firmwares,
  isLetsEncryptError,
  secureLinkSecret,
};
