'use strict';

const { pathSatisfies, defaultTo, pathEq } = require('ramda');
const {
  getOr, isPlainObject, curry, flow, get, map, keyBy, pick, negate, isUndefined, has, __, assign, isNull, isNil,
} = require('lodash/fp');

const { liftParser, META_KEY } = require('../index');
const { StatusEnum, DeviceModelEnum, TaskStatusEnum, DeviceTypeEnum } = require('../../enums');
const { isNotNull } = require('../../util');
const { parseDbSite, parseDbSiteList } = require('../site/parsers');

const indexSitesById = keyBy(get(['identification', 'id']));

// parseDbDeviceSiteId :: DbDevice -> Number|Null
const parseDbDeviceSiteId = getOr(null, ['identification', 'site', 'id']);

// parseDbDeviceIdentification :: (Auxiliaries, Object) -> DeviceIdentification
//     Auxiliaries = {dbSite: Object, correspondenceSite: Object}
//     DeviceIdentification = Object
const parseDbDeviceIdentification = ({ dbSite = null, correspondenceSite = null }, dbDevice) => {
  const site = isNotNull(dbSite)
    ? parseDbSite({}, dbSite)
    : correspondenceSite;

  return {
    id: dbDevice.identification.id,
    siteId: parseDbDeviceSiteId(dbDevice),
    site,
    mac: dbDevice.identification.mac,
    name: dbDevice.identification.name,
    serialNumber: dbDevice.identification.serialNumber,
    firmwareVersion: dbDevice.identification.firmwareVersion,
    platformId: dbDevice.identification.platformId,
    model: dbDevice.identification.model,
    updated: dbDevice.identification.timestamp,
    authorized: dbDevice.identification.authorized,
    type: dbDevice.identification.type,
    category: dbDevice.identification.category,
    ipAddress: dbDevice.identification.ipAddress,
  };
};

// parseDbDeviceFirmware :: (Object, DbDevice) -> DeviceFirmware
//     DbDevice = Object
//     DeviceFirmware = Object
const parseDbDeviceFirmware = (auxiliaries, dbDevice) => {
  const firmwareVersion = dbDevice.identification.firmwareVersion;

  /** @type {FirmwareDal} */
  const firmwareDal = auxiliaries.firmwareDal;

  if (isUndefined(firmwareDal)) { return null }

  return firmwareDal.findFirmwareDetails(dbDevice.identification.platformId, firmwareVersion);
};

// parseDbDeviceUpgradeStatus :: (Object, DbDevice) -> DeviceUpgradeStatus
//     DbDevice = Object
//     DeviceUpgradeStatus = Object
const parseDbDeviceUpgradeStatus = (auxiliaries, dbDevice) => ({
  status: getOr(null, ['upgrade', 'status'], dbDevice),
  error: getOr(null, ['upgrade', 'error'], dbDevice),
  changedAt: getOr(null, ['upgrade', 'changedAt'], dbDevice),
  expectedDuration: getOr(null, ['upgrade', 'expectedDuration'], dbDevice),
  firmware: getOr(null, ['upgrade', 'firmware'], dbDevice),
});

// parseDbDeviceConnectionStatus :: (Object, DbDevice) -> String
//     DbDevice = Object
const parseDbDeviceConnectionStatus = (auxiliaries, dbDevice) => {
  /** @type {DeviceStore} */
  const deviceStore = auxiliaries.deviceStore;

  if (pathEq(['overview', 'status'], StatusEnum.Unknown, dbDevice)) { return StatusEnum.Unknown }

  let status = getOr(StatusEnum.Disconnected, ['overview', 'status'], dbDevice);
  if (isUndefined(deviceStore)) { return status }

  switch (dbDevice.identification.model) {
    case DeviceModelEnum.Loco:
    case DeviceModelEnum.NanoG: {
      const oltId = dbDevice.onu.id;
      if (!deviceStore.exists(oltId)) { status = StatusEnum.Disconnected }
      break;
    }
    default: {
      // TODO(michal.sedlak@ubnt.com): Find a way to update status also in DB, UNMS-1106
      const deviceId = dbDevice.identification.id;
      if (!deviceStore.exists(deviceId)) { status = StatusEnum.Disconnected }
    }
  }

  return status;
};

// parseDbDeviceCanUpgrade :: (Object, DbDevice) -> Boolean
//     DbDevice = Object
const parseDbDeviceCanUpgrade = (auxiliaries, dbDevice) => {
  const connectionStatus = parseDbDeviceConnectionStatus(auxiliaries, dbDevice);
  const upgradeStatus = getOr(null, ['upgrade', 'status'], dbDevice);

  return connectionStatus === StatusEnum.Active
    && upgradeStatus !== TaskStatusEnum.InProgress
    && upgradeStatus !== TaskStatusEnum.Queued;
};

// parseDbDeviceOnu :: Object -> Onu
//     Onu = Object
const parseDbDeviceOnu = (dbDevice) => {
  if (pathSatisfies(negate(isPlainObject), ['onu'], dbDevice)) { return null }

  return {
    id: dbDevice.onu.id,
    onuId: dbDevice.onu.onuId,
    port: dbDevice.onu.port,
    profile: dbDevice.onu.profile,
    wanAddress: defaultTo('dhcp', dbDevice.wanAddress),
  };
};

// parseDbDeviceOlt :: Object -> Olt
//     Olt = Object
const parseDbDeviceOlt = (dbDevice) => {
  if (dbDevice.identification.type !== DeviceTypeEnum.Olt) { return null }

  return {
    hasUnsupportedOnu: getOr(false, ['olt', 'hasUnsupportedOnu'], dbDevice),
  };
};

// parseDbeviceAirmax :: Object -> CmAirmax
//     CmAirmax = Object
const parseDbDeviceAirmax = (dbDevice) => {
  if (dbDevice.identification.type !== DeviceTypeEnum.AirMax) { return null }

  return {
    series: getOr(null, ['airmax', 'series'], dbDevice),
    ssid: getOr(null, ['airmax', 'ssid'], dbDevice),
    frequency: getOr(0, ['airmax', 'frequency'], dbDevice),
    frequencyBands: getOr(null, ['airmax', 'frequencyBands'], dbDevice),
    frequencyCenter: getOr(null, ['airmax', 'frequencyCenter'], dbDevice),
    security: getOr('none', ['airmax', 'security'], dbDevice),
    channelWidth: getOr(0, ['airmax', 'channelWidth'], dbDevice),
    antenna: getOr(null, ['airmax', 'antenna'], dbDevice),
    noiseFloor: getOr(0, ['airmax', 'noiseFloor'], dbDevice),
    transmitChains: getOr(0, ['airmax', 'transmitChains'], dbDevice),
    receiveChains: getOr(0, ['airmax', 'receiveChains'], dbDevice),
    apMac: getOr(null, ['airmax', 'apMac'], dbDevice),
    wlanMac: getOr(null, ['airmax', 'wlanMac'], dbDevice),
    ccq: getOr(0, ['airmax', 'ccq'], dbDevice),
    stationsCount: getOr(0, ['airmax', 'stationsCount'], dbDevice),
    wirelessMode: getOr(null, ['airmax', 'wirelessMode'], dbDevice),
    remoteSignal: getOr(null, ['airmax', 'remoteSignal'], dbDevice),
    lanStatus: {
      eth0: (() => {
        if (isNil(getOr(null, ['airmax', 'lanStatus', 'eth0'], dbDevice))) { return null }

        return {
          description: dbDevice.airmax.lanStatus.eth0.description,
          plugged: dbDevice.airmax.lanStatus.eth0.plugged,
          speed: dbDevice.airmax.lanStatus.eth0.speed,
          duplex: dbDevice.airmax.lanStatus.eth0.duplex,
        };
      })(),
      eth1: (() => {
        if (isNil(getOr(null, ['airmax', 'lanStatus', 'eth1'], dbDevice))) { return null }

        return {
          description: dbDevice.airmax.lanStatus.eth1.description,
          plugged: dbDevice.airmax.lanStatus.eth1.plugged,
          speed: dbDevice.airmax.lanStatus.eth1.speed,
          duplex: dbDevice.airmax.lanStatus.eth1.duplex,
        };
      })(),
    },
    polling: {
      enabled: getOr(null, ['airmax', 'polling', 'enabled'], dbDevice),
    },
  };
};

// parseDbDeviceTemperature :: DbDevice -> Array.<Temperature>
//     DbDevice = Object
//     Temperature = {value: Number, type: String, name: String}
const parseDbDeviceTemperature = flow(
  get(['overview', 'temps']),
  map(pick(['value', 'type', 'name']))
);

// parseDbDevice :: Object -> Object -> CorrespondenceData
//     CorrespondenceData = Object
const parseDbDevice = curry((auxiliaries, dbDevice) => ({
  [META_KEY]: { auxiliaries, source: dbDevice },
  enabled: getOr(true, ['enabled'], dbDevice),
  identification: parseDbDeviceIdentification(auxiliaries, dbDevice),
  overview: {
    status: parseDbDeviceConnectionStatus(auxiliaries, dbDevice),
    canUpgrade: parseDbDeviceCanUpgrade(auxiliaries, dbDevice),
    isLocating: getOr(false, ['overview', 'locating'], dbDevice),
    cpu: getOr(null, ['overview', 'cpu'], dbDevice),
    ram: getOr(null, ['overview', 'ram'], dbDevice),
    voltage: getOr(null, ['overview', 'voltage'], dbDevice),
    temperature: parseDbDeviceTemperature(dbDevice),
    signal: getOr(null, ['overview', 'signal'], dbDevice),
    distance: getOr(null, ['overview', 'distance'], dbDevice),
    biasCurrent: getOr(null, ['overview', 'biasCurrent'], dbDevice),
    receivePower: getOr(null, ['overview', 'receivePower'], dbDevice),
    receiveRate: getOr(null, ['overview', 'rxRate'], dbDevice),
    receiveBytes: getOr(null, ['overview', 'rxBytes'], dbDevice),
    receiveErrors: getOr(null, ['overview', 'rxErrors'], dbDevice),
    receiveDropped: getOr(null, ['overview', 'rxDropped'], dbDevice),
    transmitPower: getOr(null, ['overview', 'transmitPower'], dbDevice),
    transmitRate: getOr(null, ['overview', 'txRate'], dbDevice),
    transmitBytes: getOr(null, ['overview', 'txBytes'], dbDevice),
    transmitErrors: getOr(null, ['overview', 'txErrors'], dbDevice),
    transmitDropped: getOr(null, ['overview', 'txDropped'], dbDevice),
    lastSeen: getOr(null, ['overview', 'lastSeen'], dbDevice),
    uptime: getOr(null, ['overview', 'uptime'], dbDevice),
    previousRxbytes: getOr(null, ['interfaces', 0, 'statistics', 'previousRxbytes'], dbDevice),
    previousTxbytes: getOr(null, ['interfaces', 0, 'statistics', 'previousTxbytes'], dbDevice),
    gateway: getOr(null, ['overview', 'gateway'], dbDevice),
  },
  meta: getOr(null, ['meta'], dbDevice), // unknown devices have their own meta object
  gateway: getOr(null, 'gateway', dbDevice),
  ipAddress: getOr(null, ['identification', 'ipAddress'], dbDevice),
  firmware: parseDbDeviceFirmware(auxiliaries, dbDevice),
  upgrade: parseDbDeviceUpgradeStatus(auxiliaries, dbDevice),
  mode: dbDevice.mode,
  olt: parseDbDeviceOlt(dbDevice),
  onu: parseDbDeviceOnu(dbDevice),
  airmax: parseDbDeviceAirmax(dbDevice),
  aircube: getOr(null, ['aircube'], dbDevice),
  /**
   * Just pass interfaces along, don't do anything with it. Interfaces has their own independent
   * transformers. The reason we pass it along is that we may want to parse Device from database
   * do some transformations, map it back to database form and save it to the database.
   */
  interfaces: dbDevice.interfaces,
  unmsSettings: (() => {
    const dbUnmsSettings = getOr(null, ['unmsSettings'], dbDevice);
    if (isNull(dbUnmsSettings)) { return null }

    return {
      overrideGlobal: dbUnmsSettings.overrideGlobal,
      devicePingAddress: dbUnmsSettings.devicePingAddress,
      devicePingIntervalNormal: dbUnmsSettings.devicePingIntervalNormal,
      devicePingIntervalOutage: dbUnmsSettings.devicePingIntervalOutage,
      deviceTransmissionProfile: dbUnmsSettings.deviceTransmissionProfile,
    };
  })(),
}));

// parseDbDeviceList :: (Object, Array.<DbDevice>) -> Array.<Correspondence>
//     DbDevice = Object
//     Correspondence = Object
const parseDbDeviceList = (auxiliaries, dbDeviceList) => {
  if (isUndefined(auxiliaries.dbSiteList)) { return map(parseDbDevice(auxiliaries), dbDeviceList) }

  const deviceSiteIdMap = keyBy(getOr(null, ['identification', 'site', 'id']), dbDeviceList);
  const dbSiteList = auxiliaries.dbSiteList
    .filter(pathSatisfies(has(__, deviceSiteIdMap), ['identification', 'id']));
  const siteListCorrespondence = parseDbSiteList({}, dbSiteList);
  const sitesById = indexSitesById(siteListCorrespondence);

  return dbDeviceList.map((dbDevice) => {
    const siteId = getOr(null, ['identification', 'site', 'id'], dbDevice);
    const correspondenceSite = getOr(null, siteId, sitesById);

    return parseDbDevice(assign(auxiliaries, { correspondenceSite }), dbDevice);
  });
};

// parseApiOnuUpdateRequest :: (Auxiliaries, ApiOnuUpdateRequest) -> CmOnuUpdateRequest
//    Auxiliaries         = Object
//    ApiOnuUpdateRequest = Object
//    CmOnuUpdateRequest  = Object
const parseApiOnuUpdateRequest = (auxiliaries, apiOnuUpdateRequest) =>
  pick(['profile', 'name', 'enabled'])(apiOnuUpdateRequest);


module.exports = {
  parseDbDeviceSiteId,
  parseDbDeviceIdentification,
  parseDbDeviceFirmware,
  parseDbDeviceOnu,
  parseDbDevice,
  parseDbDeviceList,
  parseApiOnuUpdateRequest,

  safeParseDbDevice: liftParser(parseDbDevice),
  safeParseDbDeviceList: liftParser(parseDbDeviceList),
  safeParseApiOnuUpdateRequest: liftParser(parseApiOnuUpdateRequest),
};
