'use strict';

const { map, isNull, getOr, pick, merge, flow, get, isEmpty } = require('lodash/fp');
const { when, pathOr, isNil } = require('ramda');

const { StatusEnum, DeviceTypeEnum } = require('../../enums');
const { isNotNull } = require('../../util');
const { liftMapper } = require('../index');
const { toApiSiteIdentification } = require('../site/mappers');
const { toApiSemver, toApiFirmware } = require('../firmwares/mappers');
const { toApiDeviceMetadata: toApiDeviceMetadataMap } = require('./metadata/mappers');
const { toApiAirmaxAttributes } = require('./airmax/mappers');
const { toApiAircubeAttributes } = require('./aircube/mappers');


/**
 * Helpers.
 *
 */

/**
 * Parser implementations.
 */

// toApiDeviceDisplayName :: CorrespondenceDataIdentification -> String
//     CorrespondenceDataIdentification = Object
const toApiDeviceDisplayName = correspondenceData => flow(
  getOr(null, ['meta', 'alias']),
  when(isEmpty, () => get(['identification', 'name'], correspondenceData))
)(correspondenceData);

// toApiDeviceIdentification :: Object -> ApiDeviceIdentification
//     ApiDeviceIdentification = Object
const toApiDeviceIdentification = correspondenceData => ({
  id: correspondenceData.identification.id,
  site: when(isNotNull, toApiSiteIdentification, correspondenceData.identification.site),
  mac: correspondenceData.identification.mac,
  name: correspondenceData.identification.name,
  serialNumber: correspondenceData.identification.serialNumber,
  firmwareVersion: correspondenceData.identification.firmwareVersion,
  model: correspondenceData.identification.model,
  platformId: correspondenceData.identification.platformId,
  type: correspondenceData.identification.type,
  category: correspondenceData.identification.category,
  authorized: correspondenceData.identification.authorized,
  updated: correspondenceData.identification.updated,
  displayName: toApiDeviceDisplayName(correspondenceData),
});

// toApiDeviceOverviewByStatus :: Object -> ApiDeviceOverviewByStatus
//     ApiDeviceOverviewByStatus = Object
const toApiDeviceOverviewByStatus = (correspondenceData) => {
  const { status, cpu, ram, signal, receiveRate, transmitRate, uptime } = correspondenceData.overview;
  const isActive = status === StatusEnum.Active;

  return {
    cpu: isActive ? cpu : null,
    ram: isActive ? ram : null,
    signal: isActive ? signal : null,
    rxRate: isActive ? receiveRate : null,
    txRate: isActive ? transmitRate : null,
    uptime: isActive ? uptime : null,
  };
};

// toApiDeviceOverview :: Object -> ApiDeviceOverview
//     ApiDeviceOverview = Object
const toApiDeviceOverview = correspondenceData => merge(
  toApiDeviceOverviewByStatus(correspondenceData),
  {
    biasCurrent: correspondenceData.overview.biasCurrent,
    canUpgrade: correspondenceData.overview.canUpgrade,
    distance: correspondenceData.overview.distance,
    isLocating: correspondenceData.overview.isLocating,
    lastSeen: correspondenceData.overview.lastSeen,
    receivePower: correspondenceData.overview.receivePower,
    rxDropped: correspondenceData.overview.receiveDropped,
    rxErrors: correspondenceData.overview.receiveErrors,
    status: correspondenceData.overview.status,
    temps: correspondenceData.overview.temps,
    transmitPower: correspondenceData.overview.transmitPower,
    txDropped: correspondenceData.overview.transmitDropped,
    txErrors: correspondenceData.overview.transmitErrors,
    voltage: correspondenceData.overview.voltage,
    rxBytes: correspondenceData.overview.receiveBytes,
    txBytes: correspondenceData.overview.transmitBytes,
  }
);

// toApiDeviceUpgradeStatus :: Object -> ApiDeviceUpgradeStatus
//     ApiDeviceUpgradeStatus = {
//       status: String,
//       error: String,
//       changeAt: Number,
//       expectedDuration: Number,
//       firmware: Object|Null
//     }
const toApiDeviceUpgradeStatus = (correspondenceData) => {
  if (isNull(correspondenceData.upgrade)) { return null }

  return {
    status: correspondenceData.upgrade.status,
    error: correspondenceData.upgrade.error,
    changedAt: correspondenceData.upgrade.changedAt,
    expectedDuration: correspondenceData.upgrade.expectedDuration,
    firmware: when(isNotNull, toApiFirmware, correspondenceData.upgrade.firmware),
  };
};

// toApiDeviceFirmware :: Object -> ApiDeviceFirmware
//     ApiDeviceFirmware = Object
const toApiDeviceFirmware = (correspondenceData) => {
  if (isNull(correspondenceData.firmware)) { return null }

  return {
    current: correspondenceData.firmware.current,
    latest: correspondenceData.firmware.latest,
    semver: {
      current: toApiSemver(correspondenceData.firmware.semver.current),
      latest: toApiSemver(correspondenceData.firmware.semver.latest),
    },
  };
};

// toApiDeviceMetadata :: Object -> ApiDeviceMetadata
//     ApiDeviceMetadata = Object
const toApiDeviceMetadata = (correspondenceData) => {
  if (correspondenceData.meta === null) { return null }

  return toApiDeviceMetadataMap(correspondenceData.meta);
};

// toApiDeviceOlt :: Object -> Olt
//     Olt = Object
const toApiDeviceOlt = (correspondenceData) => {
  if (correspondenceData.olt === null) { return null }

  return {
    hasUnsupportedOnu: getOr(false, ['olt', 'hasUnsupportedOnu'], correspondenceData),
  };
};

// toApiDeviceCanDisplayStatistics :: Object -> Boolean
const toApiDeviceCanDisplayStatistics = (correspondenceData) => {
  const isDisconnected = correspondenceData.overview.status === StatusEnum.Disconnected;

  return !isDisconnected;
};

// toApiDeviceAttributes :: DeviceCorrespondence -> ApiDeviceAttributes|Null
//     DeviceCorrespondence = Object
//     ApiDeviceAttributes = Object
const toApiDeviceAttributes = (correspondenceData) => {
  if (correspondenceData.identification.type === DeviceTypeEnum.AirMax) {
    return toApiAirmaxAttributes(correspondenceData);
  } else if (correspondenceData.identification.type === DeviceTypeEnum.AirCube) {
    return toApiAircubeAttributes(correspondenceData);
  }
  return null;
};

// toApiDeviceStatusOverview :: Object -> ApiDeviceStatusOverview
//     ApiDeviceStatusOverview = Object
const toApiDeviceStatusOverview = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  meta: toApiDeviceMetadata(correspondenceData),
  attributes: toApiDeviceAttributes(correspondenceData),
  ipAddress: getOr(null, ['identification', 'ipAddress'], correspondenceData),
});

// toApiDeviceStatusOverviewList :: CorrespondenceList -> ApiDeviceStatusOverviewList
//     ApiDeviceStatusOverviewList = Array.<ApiDeviceStatusOverview>
const toApiDeviceStatusOverviewList = map(toApiDeviceStatusOverview);

// toApiONUStatusOverview :: Object -> ApiONUStatusOverview
//     ApiONUStatusOverview = Object
const toApiONUStatusOverview = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  enabled: getOr(true, ['enabled'], correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  parentId: correspondenceData.onu.id,
  canDisplayStatistics: toApiDeviceCanDisplayStatistics(correspondenceData),
  onu: {
    id: correspondenceData.onu.id,
    port: correspondenceData.onu.port,
    profile: correspondenceData.onu.profile,
    profileName: pathOr(null, ['onu', 'profileName'], correspondenceData),
  },
});

// toApiONUStatusOverviewList :: CorrespondenceList -> ApiONUStatusOverviewList
//     ApiONUStatusOverviewList = Array.<ApiONUStatusOverview>
const toApiONUStatusOverviewList = map(toApiONUStatusOverview);

// toApiErouterStatusDetail :: Object -> ApiErouterStatusDetail
//     ApiErouterStatusDetail = Object
const toApiErouterStatusDetail = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  gateway: correspondenceData.overview.gateway,
  ipAddress: correspondenceData.identification.ipAddress,
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  meta: toApiDeviceMetadata(correspondenceData),
});

// toApiAirMaxStatusDetail :: Object -> ApiAirMaxStatusDetail
//     ApiAirMaxStatusDetail = Object
const toApiAirMaxStatusDetail = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  gateway: correspondenceData.overview.gateway,
  ipAddress: correspondenceData.identification.ipAddress,
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  meta: toApiDeviceMetadata(correspondenceData),
  mode: correspondenceData.mode,
  airmax: {
    series: correspondenceData.airmax.series,
    ssid: correspondenceData.airmax.ssid,
    frequency: correspondenceData.airmax.frequency,
    frequencyBands: correspondenceData.airmax.frequencyBands,
    frequencyCenter: correspondenceData.airmax.frequencyCenter,
    security: correspondenceData.airmax.security,
    channelWidth: correspondenceData.airmax.channelWidth,
    antenna: correspondenceData.airmax.antenna,
    noiseFloor: correspondenceData.airmax.noiseFloor,
    transmitChains: correspondenceData.airmax.transmitChains,
    receiveChains: correspondenceData.airmax.receiveChains,
    apMac: correspondenceData.airmax.apMac,
    wlanMac: correspondenceData.airmax.wlanMac,
    ccq: correspondenceData.airmax.ccq,
    stationsCount: correspondenceData.airmax.stationsCount,
    wirelessMode: correspondenceData.airmax.wirelessMode,
    remoteSignal: correspondenceData.airmax.remoteSignal,
    lanStatus: {
      eth0: (() => {
        if (isNull(correspondenceData.airmax.lanStatus.eth0)) { return null }

        return {
          description: correspondenceData.airmax.lanStatus.eth0.description,
          plugged: correspondenceData.airmax.lanStatus.eth0.plugged,
          speed: correspondenceData.airmax.lanStatus.eth0.speed,
          duplex: correspondenceData.airmax.lanStatus.eth0.duplex,
        };
      })(),
      eth1: (() => {
        if (isNull(correspondenceData.airmax.lanStatus.eth1)) { return null }

        return {
          description: correspondenceData.airmax.lanStatus.eth1.description,
          plugged: correspondenceData.airmax.lanStatus.eth1.plugged,
          speed: correspondenceData.airmax.lanStatus.eth1.speed,
          duplex: correspondenceData.airmax.lanStatus.eth1.duplex,
        };
      })(),
    },
    polling: {
      enabled: correspondenceData.airmax.polling.enabled,
    },
  },
});

// toApiAirCubeStatusDetail :: Object -> ApiAirMaxStatusDetail
//     ApiAirCubeStatusDetail = Object
const toApiAirCubeStatusDetail = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  gateway: correspondenceData.overview.gateway,
  ipAddress: correspondenceData.identification.ipAddress,
  mode: correspondenceData.mode,
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  meta: toApiDeviceMetadata(correspondenceData),
  aircube: correspondenceData.aircube,
});

// toApiOLTStatusDetail :: Object -> ApiOLTStatusDetail
//     ApiOLTStatusDetail = Object
const toApiOLTStatusDetail = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  gateway: correspondenceData.overview.gateway,
  ipAddress: correspondenceData.identification.ipAddress,
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  meta: toApiDeviceMetadata(correspondenceData),
  olt: toApiDeviceOlt(correspondenceData),
});

// toApiEswitchStatusDetail :: Object -> ApiEswitchStatusDetail
//     ApiEswitchStatusDetail = Object
const toApiEswitchStatusDetail = correspondenceData => ({
  identification: toApiDeviceIdentification(correspondenceData),
  overview: toApiDeviceOverview(correspondenceData),
  gateway: correspondenceData.overview.gateway,
  ipAddress: correspondenceData.identification.ipAddress,
  firmware: toApiDeviceFirmware(correspondenceData),
  upgrade: toApiDeviceUpgradeStatus(correspondenceData),
  meta: toApiDeviceMetadata(correspondenceData),
});

// toDbDevice :: Object -> DbDevice
//     DbDevice = Object
const toDbDevice = correspondenceData => ({
  id: correspondenceData.identification.id,
  enabled: getOr(true, ['enabled'], correspondenceData),
  identification: {
    id: correspondenceData.identification.id,
    site: {
      id: correspondenceData.identification.siteId,
    },
    mac: correspondenceData.identification.mac,
    name: correspondenceData.identification.name,
    serialNumber: correspondenceData.identification.serialNumber,
    firmwareVersion: correspondenceData.identification.firmwareVersion,
    platformId: correspondenceData.identification.platformId,
    model: correspondenceData.identification.model,
    timestamp: correspondenceData.identification.updated,
    authorized: correspondenceData.identification.authorized,
    type: correspondenceData.identification.type,
    category: correspondenceData.identification.category,
    ipAddress: getOr(null, ['identification', 'ipAddress'], correspondenceData),
  },
  overview: {
    status: correspondenceData.overview.status,
    canUpgrade: correspondenceData.overview.canUpgrade,
    locating: correspondenceData.overview.isLocating,
    cpu: correspondenceData.overview.cpu,
    ram: correspondenceData.overview.ram,
    voltage: correspondenceData.overview.voltage,
    temps: map(pick(['value', 'type', 'name']), correspondenceData.overview.temperature),
    signal: correspondenceData.overview.signal,
    distance: correspondenceData.overview.distance,
    biasCurrent: correspondenceData.overview.biasCurrent,
    receivePower: correspondenceData.overview.receivePower,
    rxRate: correspondenceData.overview.receiveRate,
    rxBytes: correspondenceData.overview.receiveBytes,
    rxErrors: correspondenceData.overview.receiveErrors,
    rxDropped: correspondenceData.overview.receiveDropped,
    transmitPower: correspondenceData.overview.transmitPower,
    txRate: correspondenceData.overview.transmitRate,
    txBytes: correspondenceData.overview.transmitBytes,
    txErrors: correspondenceData.overview.transmitErrors,
    txDropped: correspondenceData.overview.transmitDropped,
    lastSeen: correspondenceData.overview.lastSeen,
    uptime: correspondenceData.overview.uptime,
    gateway: getOr(null, ['overview', 'gateway'], correspondenceData),
  },
  upgrade: (() => {
    if (isNull(correspondenceData.upgrade)) { return null }

    return {
      status: correspondenceData.upgrade.status,
      error: correspondenceData.upgrade.error,
      changedAt: correspondenceData.upgrade.changedAt,
      expectedDuration: correspondenceData.upgrade.expectedDuration,
      firmware: correspondenceData.upgrade.firmware,
    };
  })(),
  mode: correspondenceData.mode,
  olt: (() => {
    if (isNull(correspondenceData.olt)) { return null }

    return {
      hasUnsupportedOnu: correspondenceData.olt.hasUnsupportedOnu,
    };
  })(),
  onu: (() => {
    if (isNull(correspondenceData.onu)) { return null }

    return {
      id: correspondenceData.onu.id,
      onuId: correspondenceData.onu.onuId,
      port: correspondenceData.onu.port,
      profile: correspondenceData.onu.profile,
    };
  })(),
  aircube: (() => {
    if (isNil(correspondenceData.aircube)) { return null }

    return {
      wifiMode: correspondenceData.aircube.wifiMode,
      poe: correspondenceData.aircube.poe,
      wifi2Ghz: {
        available: correspondenceData.aircube.wifi2Ghz.available,
        mode: correspondenceData.aircube.wifi2Ghz.mode,
        mac: correspondenceData.aircube.wifi2Ghz.mac,
        ssid: correspondenceData.aircube.wifi2Ghz.ssid,
        country: correspondenceData.aircube.wifi2Ghz.country,
        channel: correspondenceData.aircube.wifi2Ghz.channel,
        frequency: correspondenceData.aircube.wifi2Ghz.frequency,
        encryption: correspondenceData.aircube.wifi2Ghz.encryption,
        authentication: correspondenceData.aircube.wifi2Ghz.authentication,
        txPower: correspondenceData.aircube.wifi2Ghz.txPower,
      },
      wifi5Ghz: {
        available: correspondenceData.aircube.wifi5Ghz.available,
        mode: correspondenceData.aircube.wifi5Ghz.mode,
        mac: correspondenceData.aircube.wifi5Ghz.mac,
        ssid: correspondenceData.aircube.wifi5Ghz.ssid,
        country: correspondenceData.aircube.wifi5Ghz.country,
        channel: correspondenceData.aircube.wifi5Ghz.channel,
        frequency: correspondenceData.aircube.wifi5Ghz.frequency,
        encryption: correspondenceData.aircube.wifi5Ghz.encryption,
        authentication: correspondenceData.aircube.wifi5Ghz.authentication,
        txPower: correspondenceData.aircube.wifi5Ghz.txPower,
      },
    };
  })(),
  airmax: (() => {
    if (isNull(correspondenceData.airmax)) { return null }

    return {
      series: correspondenceData.airmax.series,
      ssid: correspondenceData.airmax.ssid,
      frequency: correspondenceData.airmax.frequency,
      frequencyBands: correspondenceData.airmax.frequencyBands,
      frequencyCenter: correspondenceData.airmax.frequencyCenter,
      security: correspondenceData.airmax.security,
      channelWidth: correspondenceData.airmax.channelWidth,
      antenna: correspondenceData.airmax.antenna,
      noiseFloor: correspondenceData.airmax.noiseFloor,
      transmitChains: correspondenceData.airmax.transmitChains,
      receiveChains: correspondenceData.airmax.receiveChains,
      apMac: correspondenceData.airmax.apMac,
      wlanMac: correspondenceData.airmax.wlanMac,
      ccq: correspondenceData.airmax.ccq,
      stationsCount: correspondenceData.airmax.stationsCount,
      wirelessMode: correspondenceData.airmax.wirelessMode,
      remoteSignal: correspondenceData.airmax.remoteSignal,
      lanStatus: {
        eth0: (() => {
          if (isNull(correspondenceData.airmax.lanStatus.eth0)) { return null }

          return {
            description: correspondenceData.airmax.lanStatus.eth0.description,
            plugged: correspondenceData.airmax.lanStatus.eth0.plugged,
            speed: correspondenceData.airmax.lanStatus.eth0.speed,
            duplex: correspondenceData.airmax.lanStatus.eth0.duplex,
          };
        })(),
        eth1: (() => {
          if (isNull(correspondenceData.airmax.lanStatus.eth1)) { return null }

          return {
            description: correspondenceData.airmax.lanStatus.eth1.description,
            plugged: correspondenceData.airmax.lanStatus.eth1.plugged,
            speed: correspondenceData.airmax.lanStatus.eth1.speed,
            duplex: correspondenceData.airmax.lanStatus.eth1.duplex,
          };
        })(),
      },
      polling: {
        enabled: correspondenceData.airmax.polling.enabled,
      },
    };
  })(),
  interfaces: getOr([], 'interfaces', correspondenceData), // just re-map the passed interfaces
  unmsSettings: (() => {
    const cmUnmsSettings = getOr(null, ['unmsSettings'], correspondenceData);
    if (isNull(cmUnmsSettings)) { return null }

    return {
      overrideGlobal: cmUnmsSettings.overrideGlobal,
      devicePingAddress: cmUnmsSettings.devicePingAddress,
      devicePingIntervalNormal: cmUnmsSettings.devicePingIntervalNormal,
      devicePingIntervalOutage: cmUnmsSettings.devicePingIntervalOutage,
      deviceTransmissionProfile: cmUnmsSettings.deviceTransmissionProfile,
    };
  })(),
});

// toDbDeviceList :: Array.<CorrespondenceData> -> Array.<DbDevice>
//     CorrespondenceData = Object
//     DbDevice = Object
const toDbDeviceList = map(toDbDevice);

module.exports = {
  toApiDeviceIdentification,
  toApiDeviceOverview,
  toApiDeviceFirmware,
  toApiDeviceCanDisplayStatistics,
  toApiDeviceStatusOverview,
  toApiDeviceStatusOverviewList,
  toApiONUStatusOverview,
  toApiONUStatusOverviewList,
  toApiErouterStatusDetail,
  toApiOLTStatusDetail,
  toApiAirMaxStatusDetail,
  toApiAirCubeStatusDetail,
  toApiEswitchStatusDetail,
  toDbDevice,
  toDbDeviceList,

  safeToApiDeviceStatusOverview: liftMapper(toApiDeviceStatusOverview),
  safeToApiDeviceStatusOverviewList: liftMapper(toApiDeviceStatusOverviewList),
  safeToApiONUStatusOverview: liftMapper(toApiONUStatusOverview),
  safeToApiONUStatusOverviewList: liftMapper(toApiONUStatusOverviewList),
  safeToApiErouterStatusDetail: liftMapper(toApiErouterStatusDetail),
  safeToApiOLTStatusDetail: liftMapper(toApiOLTStatusDetail),
  safeToApiAirMaxStatusDetail: liftMapper(toApiAirMaxStatusDetail),
  safeToApiAirCubeStatusDetail: liftMapper(toApiAirCubeStatusDetail),
  safeToApiEswitchStatusDetail: liftMapper(toApiEswitchStatusDetail),
  safeToDbDevice: liftMapper(toDbDevice),
  safeToDbDeviceList: liftMapper(toDbDeviceList),
};
