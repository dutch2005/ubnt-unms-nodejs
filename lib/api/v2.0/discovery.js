'use strict';

const aguid = require('aguid');
const semver = require('semver');
const { Maybe } = require('monet');
const { pathEq } = require('ramda');
const { sample, find, times, random, curry, uniqBy, get, isEmpty, getOr } = require('lodash/fp');
const { Chance } = require('chance');
const moment = require('moment-timezone');

const {
  DiscoveryConnectStatusEnum, DeviceModelEnum, DeviceTypeEnum, DeviceCategoryEnum, ProgressStatusEnum,
  DiscoveryDeviceFlagsEnum, DiscoveryConnectProgressEnum,
} = require('../../enums');
const { registerPlugin } = require('../../util/hapi');
const validation = require('../../validation');
const guessIpRange = require('../../discovery/guess-ip-range');

// chance generator instance.
const chance = new Chance();

const credentialsStore = new Map();

const deviceTypes = [DeviceTypeEnum.Onu, DeviceTypeEnum.Olt, DeviceTypeEnum.Erouter];

const generateDeviceVersion = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return chance.pickone(['2.1.1', '1.9.2alpha', '1.8.0', '1.6.2']);
    case DeviceTypeEnum.Olt: return '0.2.5alpha';
    case DeviceTypeEnum.Onu: return '1.0.0beta';
    default: return '1.0.0';
  }
};

const toSemver = version => version.replace(/([A-Za-z][A-Za-z0-9]*)$/, '-$1');

const generateFirmwareDescription = (type, version) => {
  const semverCompatible = toSemver(version);

  switch (type) {
    case DeviceTypeEnum.Erouter:
      return {
        current: version,
        minimumVersion: '1.9.2alpha',
        latestVersion: '1.9.2alpha2',
        compatible: semver.gte(semverCompatible, '1.9.2-alpha'),
      };
    case DeviceTypeEnum.Olt:
      return {
        current: version,
        minimumVersion: '0.2.5alpha',
        latestVersion: '0.2.5alpha',
        compatible: semver.gte(semverCompatible, '0.2.5-alpha'),
      };
    case DeviceTypeEnum.Onu:
      return {
        current: version,
        minimumVersion: '1.0.0beta',
        latestVersion: '1.0.0beta',
        compatible: semver.gte(semverCompatible, '1.0.0-beta'),
      };
    default: return {
      current: version,
      minimumVersion: '1.0.0',
      latestVersion: '1.0.0',
      compatible: false,
    };
  }
};

const generateDeviceCategory = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return DeviceCategoryEnum.Wired;
    case DeviceTypeEnum.Olt: return DeviceCategoryEnum.Optical;
    case DeviceTypeEnum.Onu: return DeviceCategoryEnum.Optical;
    default: return null;
  }
};

const generateDeviceModel = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return sample([DeviceModelEnum.ERX, DeviceModelEnum.ERX, DeviceModelEnum.ERXSFP,
      DeviceModelEnum.ERPro8, DeviceModelEnum.EPR6, DeviceModelEnum.EPR8]);
    case DeviceTypeEnum.Olt: return DeviceModelEnum.UFOLT;
    case DeviceTypeEnum.Onu: return DeviceModelEnum.NanoG;
    default: return null;
  }
};

const generateDeviceName = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return `${chance.street()}_${chance.integer({ min: 0, max: 20 })}`.replace(/ /, '_');
    case DeviceTypeEnum.Olt: return `${chance.street()}_${chance.integer({ min: 0, max: 20 })}`.replace(/ /, '_');
    case DeviceTypeEnum.Onu: return `${chance.last()}_${chance.integer({ min: 0, max: 20 })}`;
    default: return `${chance.last()}_${chance.integer({ min: 0, max: 20 })}`;
  }
};

const generateDeviceIdentification = () => {
  const type = chance.pickone(deviceTypes);
  return {
    id: aguid(),
    timestamp: Date.now(),
    firmwareVersion: generateDeviceVersion(type),
    model: generateDeviceModel(type),
    name: generateDeviceName(type),
    mac: chance.mac_address(),
    serialNumber: `${random(10000, 20000)}-${random(10000, 20000)}`,
    type,
    category: generateDeviceCategory(type),
    siteId: null,
    authorized: false,
  };
};

/* eslint-disable no-param-reassign */
const updateStatusAndFlags = (device) => {
  device.flags[DiscoveryDeviceFlagsEnum.UnsupportedFirmware] = !device.firmware.compatible;
  device.flags[DiscoveryDeviceFlagsEnum.MissingCredentials] = !credentialsStore.has(device.identification.id);
  device.flags[DiscoveryDeviceFlagsEnum.Error] = device.authentication.status === ProgressStatusEnum.Failed
    || device.error !== null;

  if (device.connect.status === DiscoveryConnectStatusEnum.Pending ||
    device.connect.status === DiscoveryConnectStatusEnum.Connected) {
    return;
  }

  device.connect.status = DiscoveryConnectStatusEnum.NotConnected;
};
/* eslint-enable no-param-reassign */


const setCredentials = curry((credentials, devices, result) => {
  const deviceIndex = new Set(devices);

  result.devices.forEach((device) => {
    if (deviceIndex.has(device.identification.id)) {
      credentialsStore.set(device.identification.id, credentials);
      device.authentication = {}; // eslint-disable-line no-param-reassign
      updateStatusAndFlags(device);
    }
  });

  return result;
});

const connectDevices = curry((devices, result) => {
  const deviceIndex = new Set(devices);

  result.devices.forEach((device) => {
    if (deviceIndex.has(device.identification.id)) {
      device.status = DiscoveryConnectStatusEnum.Pending; // eslint-disable-line no-param-reassign
    }
  });

  return result;
});

const authProgress = {};
const authResultStatus = [ProgressStatusEnum.Success, ProgressStatusEnum.Failed];

/* eslint-disable no-param-reassign */
const simulateAuthentication = (device) => {
  const timestamp = moment();
  const id = device.identification.id;
  if (credentialsStore.has(id)) {
    if (isEmpty(device.authentication)) {
      authProgress[id] = { device, timestamp };
      device.authentication.status = ProgressStatusEnum.InProgress;
    } else if (
      authProgress[id] &&
      timestamp.diff(authProgress[id].timestamp) > chance.natural({ min: 1000, max: 10000 })
    ) {
      delete authProgress[id];
      device.authentication.status = chance.pickone(authResultStatus);
      if (device.authentication.status === ProgressStatusEnum.Failed) {
        device.authentication.error = 'Authentication failed, invalid credentials';
      }
    }
  }
};

const connectProgress = {};

const simulateConnecting = (device) => {
  const timestamp = moment();
  const id = device.identification.id;
  if (device.status === DiscoveryConnectStatusEnum.Pending) {
    if (!connectProgress[id]) {
      connectProgress[id] = { device, timestamp };
      if (!device.firmware.compatible) {
        device.connect.progress = DiscoveryConnectProgressEnum.FirmwareUpgrade;
      } else {
        device.connect.progress = DiscoveryConnectProgressEnum.SettingConnectionString;
      }
    } else if (
      connectProgress[id] &&
      timestamp.diff(connectProgress[id].timestamp) > chance.natural({ min: 1000, max: 10000 })
    ) {
      delete connectProgress[id];

      if (device.connect.progress === DiscoveryConnectProgressEnum.FirmwareUpgrade) {
        device.connect.progress = DiscoveryConnectProgressEnum.SettingConnectionString;
        device.firmware.current = device.firmware.minimumVersion;
        device.firmware.compatible = true;

        connectProgress[id] = { device, timestamp };
        return;
      }

      const failed = chance.bool({ likelihood: 10 });
      if (failed) {
        device.connect = {
          status: DiscoveryConnectStatusEnum.NotConnected,
          progress: DiscoveryConnectProgressEnum.Failed,
          error: 'Random error during connecting...',
        };
      } else {
        device.connect = {
          status: DiscoveryConnectStatusEnum.Connected,
          progress: null,
          error: null,
        };
        if (!device.firmware.compatible) {
          device.firmware.current = device.firmware.minimumVersion;
          device.firmware.compatible = true;
        }
      }
    }
  }
};
/* eslint-enable no-param-reassign */

const generateDiscoveredDevice = () => {
  const identification = generateDeviceIdentification();

  const device = {
    identification,
    ip: chance.ip(),
    connect: {
      status: DiscoveryConnectStatusEnum.NotConnected,
      progress: null,
      error: null,
    },
    flags: {
      [DiscoveryDeviceFlagsEnum.MissingCredentials]: false,
      [DiscoveryDeviceFlagsEnum.UnsupportedFirmware]: false,
      [DiscoveryDeviceFlagsEnum.Error]: false,
    },
    firmware: generateFirmwareDescription(identification.type, identification.firmwareVersion),
    error: null,
    authentication: {},
  };

  updateStatusAndFlags(device);

  return device;
};

const devicesPool = times(generateDiscoveredDevice, 200);
const discoveryResults = [];

// const removeDiscoveryResult = (userId) => {
//   const index = discoveryResults.findIndex(pathEq(['userId'], userId));
//   if (index >= 0) {
//     discoveryResults.splice(index, 1);
//   }
// };

const findDiscoveryResult = userId => find(pathEq(['userId'], userId), discoveryResults);

const cancelDiscoveryResult = (userId) => {
  const result = findDiscoveryResult(userId);
  if (pathEq(['status'], ProgressStatusEnum.InProgress, result)) {
    result.status = ProgressStatusEnum.Canceled;
  }

  return result;
};

const updateResult = (result) => {
  if (result.status === ProgressStatusEnum.InProgress) {
    result.devices.push(...chance.pickset(devicesPool, 20));
    result.devices = uniqBy(get(['identification', 'id']), result.devices); // eslint-disable-line no-param-reassign
    if (result.devices.length > 120) {
      result.status = ProgressStatusEnum.Success; // eslint-disable-line no-param-reassign
    }
  }

  result.devices.forEach(simulateConnecting);
  result.devices.forEach(simulateAuthentication);
  result.devices.forEach(updateStatusAndFlags);

  return result;
};

const createDiscoveryResult = (userId, { range, method }) => {
  const identification = { id: aguid(), method, ipRange: getOr(null, 'input', range) };
  const newResult = {
    identification,
    devices: [],
    status: ProgressStatusEnum.InProgress,
    error: null,
    timestamp: new Date(),
  };

  const existingResult = findDiscoveryResult(userId);
  if (existingResult) {
    return Object.assign(existingResult, newResult);
  }

  const result = Object.assign({ userId }, newResult);
  discoveryResults.push(result);
  return result;
};

const randomDelay = fn => setTimeout(fn, chance.natural({ min: 500, max: 1500 }));

/*
 * Route definitions
 */

function register(server) {
  server.route({
    method: 'GET',
    path: '/v2.0/discovery',
    handler(request, reply) {
      Maybe.fromNull(findDiscoveryResult(/* request.token.userId */ 'mock'))
        .map(updateResult)
        .cata(() => reply({ message: 'No result' }).code(404), reply);
    },
  });

  server.route({
    method: 'DELETE',
    path: '/v2.0/discovery',
    handler(request, reply) {
      // removeDiscoveryResult(/* request.token.userId */ 'mock');
      reply({ message: 'Result deleted', result: true });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/discovery/start',
    config: {
      validate: {
        payload: validation.discoveryRequest,
      },
    },
    handler(request, reply) {
      randomDelay(() => {
        reply(createDiscoveryResult(/* request.token.userId */ 'mock', request.payload));
      });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/discovery/stop',
    handler(request, reply) {
      randomDelay(() => {
        Maybe.fromNull(cancelDiscoveryResult(/* request.token.userId */ 'mock'))
          .cata(() => reply({ message: 'No result' }).code(404), reply);
      });
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/discovery/credentials',
    config: {
      validate: {
        payload: validation.discoveryCredentials,
      },
    },
    handler(request, reply) {
      const { credentials, devices } = request.payload;
      Maybe.fromNull(findDiscoveryResult(/* request.token.userId */ 'mock'))
        .map(setCredentials(credentials, devices))
        .cata(() => reply({ message: 'No discovery result', result: false }),
              () => reply({ message: 'Credentials set', result: true }));
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/discovery/connect',
    config: {
      validate: {
        payload: validation.discoveryConnect,
      },
    },
    handler(request, reply) {
      const { devices } = request.payload;

      Maybe.fromNull(findDiscoveryResult(/* request.token.userId */ 'mock'))
        .map(connectDevices(devices))
        .cata(
          () => reply({ message: 'Failed', result: false }),
          () => reply({ message: 'Success', result: true })
        );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.0/discovery/suggest-ip-range',
    handler(request, reply) {
      reply(
        guessIpRange.fromPhysicalInterfaces()
          .map(({ networkAddress, subnetMaskLength }) => `${networkAddress}/${subnetMaskLength}`)
          .join(', ')
      );
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'discovery_v2.0',
  version: '1.0.0',
};
