'use strict';

const { Chance } = require('chance');
const aguid = require('aguid');
const moment = require('moment-timezone');
const deepfreeze = require('deep-freeze');
const randomMac = require('random-mac');
const { throttle, remove, setWith } = require('lodash');
const { isNotNull, mergeRight, isNotUndefined, isNotNil } = require('ramda-adjunct');
const {
  curry, flow, get, getOr, sample, random, clamp, isUndefined, find, merge, map, sortBy, compact, last, range,
  rangeStep, __, keyBy, identity, has, round, repeat, eq, values,
} = require('lodash/fp');
const {
  pathEq, filter, assoc, pipe, when, pair, assocPath, without, take, pathSatisfies, nth, times, concat, pick, uniqBy,
  not, anyPass, test, ifElse, equals, always,
} = require('ramda');

const { deviceModelToSeries } = require('../../feature-detection/airmax');
const {
  deviceModelsForType, isAirMaxDeviceType, isOltDeviceType, isAirCubeDeviceType, isWirelessType,
} = require('../../feature-detection/common');
const { parseSemver } = require('../../transformers/semver/parsers');
const { toApiSemver } = require('../../transformers/semver/mappers');
const config = require('../../../config');
const {
  StatusEnum, DeviceTypeEnum, DeviceModelEnum, DeviceCategoryEnum, SystemLogLevelEnum, AirMaxSeriesEnum,
  InterfaceIdentificationTypeEnum, PoeOutputEnum, WirelessModeEnum, FrequencyRangeEnum, SiteTypeEnum,
  AirCubeTxPowerEnum,
} = require('../../enums');
const { findDeviceById, findDeviceByMac: findDeviceByMacUtil } = require('../../util');


/**
 * NOTE: keep this to be valid semver
 *
 * @type {Object.<string, string>}
 */
const LATEST_FIRMWARE_VERSIONS = {
  [DeviceModelEnum.UFOLT]: '1.0.4',
  [DeviceModelEnum.NanoG]: '1.2.0',
  [DeviceModelEnum.ERX]: '1.9.7-hotfix4',
  [DeviceModelEnum.ERXSFP]: '1.9.7-hotfix4',
  [DeviceModelEnum.ERLite3]: '1.9.7-hotfix4',
  [DeviceModelEnum.ERPoe5]: '1.9.7-hotfix4',
  [DeviceModelEnum.ERPro8]: '1.9.7-hotfix4',
  [DeviceModelEnum.ER8]: '1.9.7-hotfix4',
  [DeviceModelEnum.EPR6]: '1.9.7-hotfix4',
  [DeviceModelEnum.EPR8]: '1.9.7-hotfix4',
  [DeviceModelEnum.ER8XG]: '1.9.7-hotfix4',
  [DeviceModelEnum.ACBAC]: '1.1.1',
  [DeviceModelEnum.ACBISP]: '1.1.1',
  [DeviceModelEnum.ACBLOCO]: '1.1.1',
};

const chance = new Chance();
const uptime = {};
const devices = [];

/**
 * @function latestFirmwareVersion
 * @signature latestFirmwareVersion :: DeviceModelEnum -> String
 *                DeviceModelEnum = String
 * @param {DeviceModelEnum|string} model
 * @return {string}
 */
const latestFirmwareVersion = getOr(null, __, LATEST_FIRMWARE_VERSIONS);

const signalRanges = deepfreeze({
  wifi: { min: -90, max: -40 },
  optical: { min: -25, max: -10 },
});

const getSignalRange = (type) => {
  switch (type) {
    case DeviceTypeEnum.Onu:
      return signalRanges.optical;
    case DeviceTypeEnum.AirMax:
    case DeviceTypeEnum.AirCube:
      return signalRanges.wifi;
    default:
      return null;
  }
};

const generateDeviceVersion = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return '1.9.7';
    case DeviceTypeEnum.AirMax: return '8.1.3'; // 6.0.7
    case DeviceTypeEnum.Olt: return '1.0.2';
    case DeviceTypeEnum.Onu: return '1.1.1';
    case DeviceTypeEnum.AirCube: return '1.1.2';
    default: return '1.0.0';
  }
};

const generateDeviceVersionBySeries = (series, type) => {
  if (type === DeviceTypeEnum.AirMax) {
    switch (series) {
      case AirMaxSeriesEnum.AC:
        return '8.1.3';
      case AirMaxSeriesEnum.M:
        return '6.0.7';
      default: return '1.0.0';
    }
  }
  return '1.0.0';
};

const getSiteIdentification = flow(
  (sites, siteId) => (siteId ? sites.find(pathEq(['identification', 'id'], siteId)) : sample(sites)),
  get('identification'),
  identification => assoc('parent', getOr(null, ['parent', 'id'], identification), identification)
);

const maskedModels = keyBy(identity, [
  // - AirMax
  DeviceModelEnum.M25,
  DeviceModelEnum.PAP,
  DeviceModelEnum.LAPHP,
  DeviceModelEnum.LAP,
  DeviceModelEnum.AGW,
  DeviceModelEnum.AGWLR,
  DeviceModelEnum.AGWPro,
  DeviceModelEnum.AGWInstaller,
  DeviceModelEnum.SM5,
  DeviceModelEnum.WM5,

  // - Edgerouters
  DeviceModelEnum.ER4,

  // - AirCube
  DeviceModelEnum.ACBLOCO,

  // - Olt
  DeviceModelEnum.UFOLT4,
]);

const filterModels = (model) => {
  if (has(model, maskedModels)) {
    if (isAirMaxDeviceType(model)) { return DeviceModelEnum.R2N }
    if (isAirCubeDeviceType(model)) { return DeviceModelEnum.ACBAC }
    if (isOltDeviceType(model)) { return DeviceModelEnum.UFOLT }
    return DeviceModelEnum.ERX;
  }

  return model;
};

const generateDeviceModel = flow(
  flow(deviceModelsForType, sample),
  filterModels
);

const generateDeviceCategory = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return DeviceCategoryEnum.Wired;
    case DeviceTypeEnum.Olt: return DeviceCategoryEnum.Optical;
    case DeviceTypeEnum.Onu: return DeviceCategoryEnum.Optical;
    default: return null;
  }
};

const generateDeviceName = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter:
    case DeviceTypeEnum.Olt:
      return `${chance.street()}_${chance.integer({ min: 0, max: 20 })}`.replace(/ /, '_');
    case DeviceTypeEnum.Onu:
      return `${chance.last()}_${chance.integer({ min: 0, max: 20 })}`;
    default:
      return `${chance.last()}_${chance.integer({ min: 0, max: 20 })}`;
  }
};

const generateDeviceIdentification = (sites, meta, deviceId) => {
  const type = sample([
    DeviceTypeEnum.Onu, DeviceTypeEnum.Olt, DeviceTypeEnum.Erouter, DeviceTypeEnum.AirMax, DeviceTypeEnum.AirCube,
  ]);
  const name = generateDeviceName(type);
  return {
    type,
    id: deviceId,
    timestamp: Date.now(),
    firmwareVersion: generateDeviceVersion(type),
    model: pipe(
      generateDeviceModel, // TODO<michael.kuk@ubnt.com> remove when LOCO assets are present
      when(equals(DeviceModelEnum.ACBLOCO), always(DeviceModelEnum.ACBISP))
    )(type),
    name,
    displayName: isNotNull(meta.alias) ? meta.alias : name,
    mac: randomMac(),
    serialNumber: `${random(10000, 20000)}-${random(10000, 20000)}`,
    category: generateDeviceCategory(type),
    site: getSiteIdentification(sites),
  };
};

const correctFirmwareBySeries = ({ series }, identification) =>
  assocPath(['firmwareVersion'], generateDeviceVersionBySeries(series, identification.type), identification);

const isEthernetInterfaceType = anyPass([
  test(/^wan/i),
  test(/^eth/i),
  test(/^lan/i),
]);

const isWifiInterfaceType = test(/^wlan\d+/);

const isBridgeInterfaceType = test(/^br/);

const interfaceNameToType = (interfaceName) => {
  if (isEthernetInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Ethernet;
  } else if (isBridgeInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Bridge;
  } else if (isWifiInterfaceType(interfaceName)) {
    return InterfaceIdentificationTypeEnum.Wifi;
  }
  return null;
};

const generateAcbInterface = name => ({
  identification: {
    position: null,
    type: interfaceNameToType(name),
    name,
    description: null,
    mac: randomMac(),
  },
  statistics: {
    timestamp: Date.now(),
    rxrate: 0,
    rxbytes: 0,
    txrate: 0,
    txbytes: 0,
    dropped: 0,
    errors: 0,
    previousTxbytes: 0,
    previousRxbytes: 0,
    previousDropped: 0,
    previousErrors: 0,
  },
  addresses: [],
  mtu: 1500,
  poe: ifElse(
    equals('wan0'),
    always([PoeOutputEnum.PASSTHROUGH]),
    always(null)
  )(name),
  enabled: true,
  proxyARP: null,
  vif: null,
  switch: null,
  bridgeGroup: null,
  onSwitch: false,
  isSwitchedPort: false,
  status: {
    autoneg: false,
    duplex: true,
    speed: null,
    description: null,
    plugged: null,
    sfp: null,
  },
  vlan: null,
  pppoe: null,
  pon: null,
  bridge: null,
  ospf: {
    ospfCapable: false,
    ospfConfig: null,
  },
});

const generateAcbInterfaces = () => [
  generateAcbInterface('lan0'),
  generateAcbInterface('wan0'),
  generateAcbInterface('br-lan'),
  generateAcbInterface('eth0'),
  generateAcbInterface('wlan0'),
  generateAcbInterface('wlan1'),
];

const generateInterfaces = (type) => {
  let ethInterfaces = 10;

  if (type === DeviceTypeEnum.Onu) {
    ethInterfaces = 1;
  } else if (type === DeviceTypeEnum.AirMax) {
    ethInterfaces = 2;
  }

  if (type === DeviceTypeEnum.AirCube) {
    return generateAcbInterfaces();
  }

  return range(0, ethInterfaces).map(i => ({
    identification: {
      name: `eth${i}`,
      mac: randomMac(),
    },
  }));
};

const generateSignal = (type) => {
  // occasionally devices can have very low signal
  if (chance.bool({ likelihood: 10 })) { return chance.floating({ min: -40, max: -20 }) }

  const signalRange = getSignalRange(type);
  if (signalRange === null) { return 0 }

  const { min, max } = signalRange;
  return chance.floating({ min, max });
};

const generateTemps = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return [];
    case DeviceTypeEnum.Olt: return [
      { value: 31, type: 'Board', name: 'Board 1' },
      { value: 43, type: 'Board', name: 'Board 2' },
      { value: 36, type: 'Board', name: 'Board 3' }];
    case DeviceTypeEnum.Onu: return [
      { value: 50, type: 'CPU', name: 'cpu' }];
    default: return [];
  }
};

const generateDeviceOverview = type => ({
  status: StatusEnum.Active,
  uptime: random(1, 2000000),
  lastSeen: Date.now(),
  cpu: random(2, 20),
  ram: random(5, 15),
  voltage: random(24, 25),
  signal: round(generateSignal(type)),
  locating: false,
  canUpgrade: false,
  temps: generateTemps(type),
  distance: 30,
  transmitPower: 2.8,
  receivePower: -21.92,
  biasCurrent: 7.678,
  rxRate: 0,
  rxBytes: 250,
  rxDropped: null,
  rxErrors: null,
  txRate: 0,
  txBytes: 250,
  txDropped: null,
  txErrors: null,
});

const generateFirmware = curry((model, current) => {
  const latest = parseSemver(latestFirmwareVersion(model));
  return ({
    current: current.raw,
    latest: isNotNull(latest) ? latest.raw : null,
    semver: {
      current: toApiSemver(current),
      latest: isNotNull(latest) ? toApiSemver(latest) : null,
    },
  });
});

const generateUnmsSettings = () => ({
  overrideGlobal: false,
  devicePingAddress: 'localhost',
  devicePingIntervalNormal: 30000,
  devicePingIntervalOutage: 5000,
  deviceTransmissionProfile: 'high',
});

const generateMetadata = () => ({
  failedMessageDecryption: false,
  restartTimestamp: null,
  alias: chance.bool() ? chance.word() : null,
  note: chance.bool() ? chance.sentence({ words: 10 }) : null,
});

const generateAttributes = (type, model) => {
  if (type === DeviceTypeEnum.AirMax) {
    return { series: deviceModelToSeries(model) };
  }
  return null;
};

const generateFrequencyBand = (minFreq, maxFreq) => {
  const frequencyList = rangeStep(5, minFreq, maxFreq);
  const min = 5;
  const max = 25;
  const change = (max - min) / 5;
  let tmp = chance.integer({ min, max });

  const next = () => {
    const diff = chance.integer({ min: -change, max: change });

    if (tmp + diff > max || tmp + diff < min) {
      tmp -= diff;
    } else {
      tmp += diff;
    }
    return tmp;
  };

  return map(f => pair(f, next()), frequencyList);
};

// TODO(jan.beseda@ubnt.com): create chance for rest of the properties once dashboard complete
const generateAirMax = attributes => pipe(getOr(null, ['series']), when(isNotNull, series => ({
  antenna: 'Feed only',
  apMac: chance.mac_address(),
  ccq: chance.integer({ min: 0, max: 100 }),
  channelWidth: 40,
  frequency: 5570,
  frequencyCenter: 5560,
  frequencyBands: generateFrequencyBand(5098, 5899),
  lanStatus: {
    eth0: {
      description: null,
      duplex: true,
      plugged: true,
      speed: 1000,
    },
    eth1: {
      description: null,
      duplex: true,
      plugged: true,
      speed: 100,
    },
  },
  noiseFloor: 0,
  polling: {
    enabled: true,
  },
  receiveChains: 3,
  remoteSignal: round(generateSignal(DeviceTypeEnum.AirMax)),
  security: 'none',
  series,
  ssid: 'ubnt AirMax',
  stationsCount: 1,
  transmitChains: 3,
  wirelessMode: 'sta-ptp',
  wlanMac: [chance.mac_address()],
})))(attributes);

const generateAircube = ifElse(
  pathEq(['type'], DeviceTypeEnum.AirCube),
  () => ({
    wifiMode: WirelessModeEnum.Ap,
    poe: false,
    stations: null,
    wifi2Ghz: {
      available: true,
      mode: WirelessModeEnum.Ap,
      mac: randomMac(),
      ssid: chance.word(),
      country: 'CA',
      channel: chance.integer({ min: 1, max: 12 }),
      frequency: chance.integer({ min: 2400, max: 2499 }),
      encryption: 'wpa2',
      authentication: 'psk',
      txpower: chance.pickone(values(AirCubeTxPowerEnum)),
    },
    wifi5Ghz: {
      available: true,
      mode: WirelessModeEnum.Ap,
      mac: randomMac(),
      ssid: chance.word(),
      country: 'CA',
      channel: chance.integer({ min: 1, max: 36 }),
      frequency: chance.integer({ min: 5100, max: 5499 }),
      encryption: 'wpa2',
      authentication: 'psk',
      txpower: chance.pickone(values(AirCubeTxPowerEnum)),
    },
  }),
  always(null)
);

const generateDevice = curry((sites, deviceId) => {
  const meta = generateMetadata();
  let identification = generateDeviceIdentification(sites, meta, deviceId);
  const interfaces = generateInterfaces(identification.type);
  const overview = generateDeviceOverview(identification.type);
  const unmsSettings = generateUnmsSettings();
  const attributes = generateAttributes(identification.type, identification.model);
  identification = has('series', attributes) ? correctFirmwareBySeries(attributes, identification) : identification;
  const firmware = flow(parseSemver, generateFirmware(identification.model))(identification.firmwareVersion, true);
  const airmax = generateAirMax(attributes);
  const aircube = generateAircube(identification);
  uptime[deviceId] = moment().subtract(overview.uptime, 'second');
  const device = {
    airmax,
    aircube,
    meta,
    identification,
    firmware,
    interfaces,
    overview,
    attributes,
    id: deviceId,
    parentId: null,
    unms: unmsSettings,
    mode: 'bridge',
    gateway: chance.ip(),
    ipAddress: chance.ip(),
  };

  devices.push(device);
  return device;
});

const generateDevices = sites => range(6000, 6000 + config.fixtures.device.count)
  .map(aguid)
  .map(generateDevice(sites));

const filterDevicesBySiteId = curry((siteId, devicesToFilter) => {
  if (isUndefined(siteId)) { return devicesToFilter }
  return filter(pathEq(['identification', 'site', 'id'], siteId), devicesToFilter);
});

const filterDevicesByParentId = curry((deviceId, devicesToFilter) => {
  if (isUndefined(deviceId)) { return devicesToFilter }
  return filter(pathEq(['parentId'], deviceId), devicesToFilter);
});

const generateDeviceStatus = (type, status) => {
  const p = random(0, 100);
  switch (type) {
    case DeviceTypeEnum.Olt:
    case DeviceTypeEnum.Erouter:
      if (status === StatusEnum.Active) {
        if (p > 98) {
          return StatusEnum.Unauthorized;
        } else if (p > 95) {
          return StatusEnum.Disconnected;
        }
      } else if (status === StatusEnum.Disconnected) {
        if (p < 5) {
          return StatusEnum.Disconnected;
        }
      } else if (status === StatusEnum.Unauthorized) {
        if (p < 5) {
          return StatusEnum.Unauthorized;
        }
      }
      break;
    case DeviceTypeEnum.Onu:
      if (status === StatusEnum.Active) {
        if (p > 98) {
          return StatusEnum.Unauthorized;
        } else if (p > 95) {
          return StatusEnum.Disconnected;
        } else if (p > 90) {
          return StatusEnum.Disabled;
        }
      } else if (status === StatusEnum.Disconnected) {
        if (p < 5) {
          return StatusEnum.Disconnected;
        }
      } else if (status === StatusEnum.Unauthorized) {
        if (p < 5) {
          return StatusEnum.Unauthorized;
        }
      } else if (status === StatusEnum.Disabled) {
        if (p < 10) {
          return StatusEnum.Disabled;
        }
      }
      break;
    default:
      return status;
  }
  return StatusEnum.Active;
};

/* eslint-disable no-param-reassign */
const refreshDeviceStatus = curry(throttle((sites) => {
  devices.forEach((d) => {
    const status = generateDeviceStatus(d.identification.type, d.overview.status);

    d.overview.status = status;
    if (status !== StatusEnum.Active) {
      d.overview.lastSeen = moment().subtract(random(0, 2000), 'minute').valueOf();
    }
    if (status === StatusEnum.Unauthorized) {
      d.overview.lastSeen = null;
      d.identification.site = null;
    } else if (d.identification.site === null) {
      d.identification.site = getSiteIdentification(sites);
    }
  });
}, 20000, { trailing: false }), 2); // run no more than every 20 seconds
/* eslint-enable no-param-reassign */


const updateStatsValue = (fn, opts, lastValue) => {
  if (opts === null) { return 0 }

  const { min, max } = opts;
  const diffRange = Math.abs(max - min) / 200; // max diff is 100th of the range
  const nextValue = !lastValue
    ? fn.call(chance, { min, max })
    : lastValue + fn.call(chance, { min: -diffRange, max: diffRange });

  return clamp(min, max, nextValue);
};

const updateSignal = (device) => {
  const signalRange = getSignalRange(device.identification.type);
  if (signalRange === null) { return 0 }
  const value = device.overview.signal;
  // normalize value gradually if a device signal is out of range scope
  if (value < signalRange.min) {
    return value + chance.floating({ min: 0.1, max: 0.5 });
  }

  return updateStatsValue(chance.floating, signalRange, device.overview.signal);
};

const updateUptime = (device, isDeviceActive) => {
  if (!isDeviceActive) {
    uptime[device.id] = null;
    return 0;
  }
  if (uptime[device.id] === null) { uptime[device.id] = moment() }

  return moment().diff(uptime[device.id], 'second');
};

const updateDevice = (device) => {
  /* eslint-disable no-param-reassign */
  const isDeviceActive = pathEq(['overview', 'status'], StatusEnum.Active, device);
  device.overview.uptime = updateUptime(device, isDeviceActive);
  device.overview.lastSeen = isDeviceActive ? Date.now() : device.overview.lastSeen;
  device.overview.cpu = isDeviceActive ? updateStatsValue(chance.integer, { min: 2, max: 20 }, device.overview.cpu) : 0;
  device.overview.ram = isDeviceActive ? updateStatsValue(chance.integer, { min: 5, max: 15 }, device.overview.ram) : 0;
  device.overview.signal = isDeviceActive ? round(updateSignal(device)) : 0;
  /* eslint-enable no-param-reassign */
};

const refreshDevices = (sites) => {
  refreshDeviceStatus(sites);
  devices.forEach(updateDevice);
  return devices;
};

const getDevices = () => devices;

const removeDeviceById = deviceId => remove(devices, pathEq(['identification', 'id'], deviceId));

const authorizeDevice = (sites, siteId, deviceId) => {
  const device = findDeviceById(deviceId, devices);
  device.overview.status = StatusEnum.Active;
  device.identification.site = getSiteIdentification(sites, siteId);
};

const upgradeDeviceFirmwareToLatest = (deviceId) => {
  const device = findDeviceById(deviceId, devices);
  const latestVersion = latestFirmwareVersion(device.identification.model);

  device.identification.firmwareVersion = latestVersion;
  device.firmware = generateFirmware(device.identification.model, parseSemver(latestVersion));
};

const generateSystem = name => ({
  name,
  timezone: 'Europe/Prague',
  domainName: '',
  admin: {
    login: {
      username: 'admin',
    },
  },
  gateway: '192.168.99.1',
  dns1: '8.8.8.8',
  dns2: '8.8.4.4',
  readOnlyAccount: {
    enabled: true,
    login: {
      username: 'user',
    },
  },
  timezoneList: moment.tz.names(),
});

const generateServices = () => ({
  ntpClient: {
    enabled: true,
    ntpServer1: '0.cz.pool.ntp.org',
    ntpServer2: '1.cz.pool.ntp.org',
  },
  sshServer: {
    enabled: true,
    sshPort: 22,
  },
  systemLog: {
    enabled: true,
    server: '192.168.90.30',
    level: SystemLogLevelEnum.Error,
  },
  telnetServer: {
    enabled: true,
    port: 23,
  },
  snmpAgent: {
    enabled: true,
    community: 'public',
    contact: 'con',
    location: 'loc',
  },
  webServer: {
    enabled: true,
    httpPort: 80,
    httpsPort: 443,
  },
  discovery: {
    enabled: true,
  },
});

const ensureDeviceServices = (deviceId) => {
  const device = findDeviceById(deviceId, devices);
  if (isUndefined(device.services)) {
    device.services = generateServices();
  }
  return device;
};

const getDeviceServices = flow(ensureDeviceServices, get(['services']));

const updateDeviceServices = (deviceId, requestPayload) => flow(
  ensureDeviceServices,
  (device) => {
    // eslint-disable-next-line no-param-reassign
    device.services = merge(device.services, requestPayload);
    return device.services;
  }
)(deviceId);

const ensureDeviceSystem = (deviceId) => {
  const device = findDeviceById(deviceId, devices);
  if (isUndefined(device.system)) {
    device.system = generateSystem(get(['identification', 'name'], device));
  }
  return device;
};

const getDeviceSystem = flow(ensureDeviceSystem, get(['system']));

const updateDeviceSystem = (deviceId, requestPayload) => flow(
  ensureDeviceSystem,
  (device) => {
    // eslint-disable-next-line no-param-reassign
    device.system = merge(device.system, requestPayload);
    return device.system;
  }
)(deviceId);

const getEth0MacAddress = flow(
  get(['interfaces']),
  find(pathEq(['identification', 'name'], 'eth0')),
  get(['identification', 'mac'])
);

const getMacAddressFromDeviceByType = (device) => {
  switch (get(['identification', 'type'], device)) {
    case 'erouter':
    case 'olt':
      return getEth0MacAddress(device);
    case 'onu': // onus MAC addresses not needed
      return null;
    default:
      console.log('error', { message: 'Unexpected device type', device });
      return null;
  }
};

const getMacAddresses = flow(map(getMacAddressFromDeviceByType), compact);

const getDeviceUnmsSettings = deviceId => flow(findDeviceById, get(['unms']))(deviceId, devices);

const updateDeviceUnmsSettings = (deviceId, requestPayload) => flow(
  getDeviceUnmsSettings,
  mergeRight(requestPayload)
)(deviceId);

/*
 * Stations
 */

const generateStation = ({ device, hostDevice }) => {
  const type = getOr(
    sample([DeviceTypeEnum.AirMax, DeviceTypeEnum.AirCube]),
    ['identification', 'type'],
    hostDevice || device
  );

  return {
    name: getOr(generateDeviceName(type), ['identification', 'name'], device),
    mac: getOr(chance.mac_address(), ['identification', 'mac'], device),
    ipAddress: getOr(chance.ip(), ['identification', 'ipAddress'], device),
    upTime: chance.integer({ min: 1, max: 15000 }),
    latency: chance.integer({ min: 1, max: 25 }),
    distance: chance.integer({ min: 1, max: 2000 }),
    rxBytes: chance.integer({ min: 256, max: 4096 }),
    txBytes: chance.integer({ min: 256, max: 4096 }),
    rxRate: chance.integer({ min: 256, max: 3145728 }),
    txRate: chance.integer({ min: 256, max: 3145728 }),
    rxSignal: generateSignal(type),
    txSignal: generateSignal(type),
    vendor: 'UBNT',
    radio:
      hostDevice && hostDevice.identification.model === DeviceModelEnum.ACBAC && chance.bool() ?
      FrequencyRangeEnum.Wifi5GHz : FrequencyRangeEnum.Wifi2GHz,
    downlinkCapacity: chance.integer({ min: 256, max: 3145728 }),
    uplinkCapacity: chance.integer({ min: 256, max: 3145728 }),
  };
};

const pickOtherRandomDevice = device => flow(
  filter(pathSatisfies(isWirelessType, ['identification', 'type'])),
  without([device]),
  filteredDevices => nth(chance.integer({ min: 0, max: filteredDevices.length - 1 }), filteredDevices)
)(devices);

const hasDeviceStations = (device) => {
  switch (get(['identification', 'type'], device)) {
    case DeviceTypeEnum.AirMax:
      return pathSatisfies(isNotNil, ['airmax', 'stations'], device);
    case DeviceTypeEnum.AirCube:
      return pathSatisfies(isNotNil, ['aircube', 'stations'], device);
    default:
      return false;
  }
};
const getDeviceWithStations = (deviceId) => {
  const device = findDeviceById(deviceId, devices);
  if (not(hasDeviceStations(device)) && pathSatisfies(isWirelessType, ['identification', 'type'], device)) {
    const unkownDeviceStations = times(
      () => generateStation({ hostDevice: device }), chance.integer({ min: 1, max: 50 })
    );
    const existingDeviceStations = flow(
      times(() => generateStation({ device: pickOtherRandomDevice(device) })),
      uniqBy(get(['mac']))
    )(chance.integer({ min: 1, max: 50 }));

    if (pathSatisfies(eq(DeviceTypeEnum.AirMax), ['identification', 'type'], device)) {
      device.airmax.stations = concat(existingDeviceStations, unkownDeviceStations);
    }

    if (pathSatisfies(eq(DeviceTypeEnum.AirCube), ['identification', 'type'], device)) {
      device.aircube.stations = unkownDeviceStations;
    }
  }
  return device;
};

/*
 * Backups
 */
const generateBackupItem = (id, timestamp) => ({
  id,
  timestamp: timestamp || chance.date({ min: (new Date(2016, 1)), max: (new Date()) }).valueOf(),
});

const generateBackups = flow(range, map(aguid), map(generateBackupItem), sortBy(['-timestamp']));

const backupsIdStart = 5000;
let backupsLastId = backupsIdStart + 250;

const backupsList = generateBackups(backupsIdStart, backupsLastId);

const getBackupData = repeat(100);

const getBackupsList = () => backupsList;

const createNewBackup = () => {
  const backup = generateBackupItem(aguid(backupsLastId), Date.now());
  backupsList.unshift(backup);
  backupsLastId += 1;

  return backup;
};

const uploadBackup = () => {
  const backup = generateBackupItem(aguid(backupsLastId), Date.now());
  backupsList.unshift(backup);
  backupsLastId += 1;

  return backup;
};

const removeBackupById = backupId => remove(backupsList, pathEq(['id'], backupId));


/*
 * Statistics
 */
const generatorWrapper = (fn) => {
  const gen = (x) => {
    let val = gen.cache[x];
    if (isUndefined(val)) {
      val = fn();
      gen.cache[x] = val;
    }
    return val;
  };

  gen.cache = {};

  return gen;
};

const makeSeriesGenerator = (min, max) => {
  const change = (max - min) / 5;
  let tmp = chance.integer({ min, max });

  const next = () => {
    const diff = chance.integer({ min: -change, max: change });

    if (tmp + diff > max || tmp + diff < min) {
      tmp -= diff;
    } else {
      tmp += diff;
    }
    return tmp;
  };

  return generatorWrapper(next);
};

const makeErrorGenerator = (rate) => {
  let outage = chance.natural({ max: 100 }) <= rate;

  const update = () => {
    outage = outage !== (chance.natural({ max: 100 }) <= rate);
  };

  return generatorWrapper(() => {
    update();
    return outage ? 1 : 0;
  });
};

const generateSeries = (timeSeries, generator) => timeSeries.map(x => ({ x, y: generator(x) }));

const generateStatsResponse = (interval, responseGenerator) => {
  const period = config.statisticsIntervalPeriodMapping[interval];
  const length = config.statisticsIntervalLengthMapping[interval];

  let end = Date.now();
  let start = end - length;
  start -= start % period;
  let timeSeries = rangeStep(period, start, end);
  if (last(timeSeries) !== end) {
    timeSeries.push(end);
  }

  return () => {
    const now = Date.now();
    start = now - length;
    if (now > (end + period)) {
      const countSeries = timeSeries.length;
      timeSeries.push(...rangeStep(period, end + period, now));
      end = now;
      if (last(timeSeries) + period <= end) {
        timeSeries.push(end - (end % period));
      }
      const countAddedSeries = timeSeries.length - countSeries;
      timeSeries = without(take(countAddedSeries, timeSeries), timeSeries);
    }

    return responseGenerator(period, { start, end }, timeSeries);
  };
};

const generateRandomStats = (requestInterval, device) => {
  const generators = {
    ram: makeSeriesGenerator(10, chance.floating({ min: 50, max: 90 })),
    cpu: makeSeriesGenerator(10, chance.floating({ min: 50, max: 90 })),
    ping: makeSeriesGenerator(5, chance.natural({ min: 10, max: 50 })),
    signal: makeSeriesGenerator(-70, chance.floating({ min: -70, max: -20 })),
    remoteSignal: makeSeriesGenerator(-70, chance.floating({ min: -70, max: -20 })),
    errors: makeErrorGenerator(chance.natural({ min: 0, max: 10 })),
    interfaces: device.interfaces.map(i => ({
      name: i.identification.name,
      receive: makeSeriesGenerator(chance.natural({ min: 0, max: 50 * 10e4 }), chance.natural({
        min: 150 * 10e4,
        max: 1550 * 10e4,
      })),
      transmit: makeSeriesGenerator(chance.natural({ min: 0, max: 20 * 10e4 }), chance.natural({
        min: 50 * 10e4,
        max: 100 * 10e4,
      })),
    })),
  };

  return generateStatsResponse(requestInterval, (period, interval, timeSeries) => {
    const errors = generateSeries(timeSeries, generators.errors);
    const ping = generateSeries(timeSeries, generators.ping)
      .map((p, i) => (errors[i].y === 1 ? { x: p.x, y: 0 } : p));

    let signal = null;
    let remoteSignal = null;
    if (device.identification.type === DeviceTypeEnum.AirMax) {
      signal = generateSeries(timeSeries, generators.signal);
      remoteSignal = generateSeries(timeSeries, generators.remoteSignal);
    }

    return {
      period,
      interval,
      ram: generateSeries(timeSeries, generators.ram),
      cpu: generateSeries(timeSeries, generators.cpu),
      ping,
      errors,
      power: null,
      signal,
      remoteSignal,
      interfaces: generators.interfaces.map(iface => ({
        name: iface.name,
        receive: generateSeries(timeSeries, iface.receive),
        transmit: generateSeries(timeSeries, iface.transmit),
      })),
    };
  });
};

const generateRandomNMSStats = (requestInterval, sites) => {
  const sitesAmount = sites.filter(pathSatisfies(eq(SiteTypeEnum.Site), ['identification', 'type'])).length;
  const endpointsAmount = sites.length - sitesAmount;

  const generators = {
    networkHealth: makeSeriesGenerator(
      30, chance.floating({ min: 85, max: 100 })),
    allSites: makeSeriesGenerator(sitesAmount, sitesAmount),
    liveSites: makeSeriesGenerator(
      sitesAmount - 10, chance.floating({ min: sitesAmount - 5, max: sitesAmount })),
    allClients: makeSeriesGenerator(endpointsAmount, endpointsAmount),
    liveClients: makeSeriesGenerator(
      endpointsAmount - 10, chance.floating({ min: endpointsAmount - 5, max: endpointsAmount })),
  };

  return generateStatsResponse(requestInterval, (period, interval, timeSeries) => ({
    period,
    interval,
    networkHealth: generateSeries(timeSeries, generators.networkHealth),
    allSites: generateSeries(timeSeries, generators.allSites),
    liveSites: generateSeries(timeSeries, generators.liveSites),
    allClients: generateSeries(timeSeries, generators.allClients),
    liveClients: generateSeries(timeSeries, generators.liveClients),
  }));
};

const statistics = {};

const getStatistics = (deviceId, interval) => {
  const device = findDeviceById(deviceId, devices);
  let deviceStats = get([deviceId, interval], statistics);

  if (!deviceStats) {
    deviceStats = generateRandomStats(interval, device);
    setWith(statistics, [deviceId, interval], deviceStats, Object);
  }

  return deviceStats();
};

const getNMSStatistics = (interval, sites) => {
  let nmsStats = get(['nms', interval], statistics);

  if (!nmsStats) {
    nmsStats = generateRandomNMSStats(interval, sites);
    setWith(statistics, ['nms', interval], nmsStats, Object);
  }

  return nmsStats();
};

const findDeviceByMac = mac => flow(
  findDeviceByMacUtil,
  when(isNotUndefined, pick(['identification'])),
  when(isNotUndefined, pick(['id', 'type']))
)(mac, devices);

/*
 *  Module
 */
module.exports = {
  authorizeDevice,
  createNewBackup,
  findDeviceByMac,
  filterDevicesByParentId,
  filterDevicesBySiteId,
  generateDevices,
  getBackupData,
  getBackupsList,
  getDevices,
  getDeviceServices,
  getDeviceSystem,
  getDeviceUnmsSettings,
  getMacAddresses,
  getStatistics,
  getNMSStatistics,
  getDeviceWithStations,
  refreshDevices,
  removeBackupById,
  removeDeviceById,
  updateDeviceServices,
  updateDeviceSystem,
  updateDeviceUnmsSettings,
  upgradeDeviceFirmwareToLatest,
  uploadBackup,
};
