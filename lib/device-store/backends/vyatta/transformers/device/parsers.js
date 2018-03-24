'use strict';

const { defaultTo, match, allPass, pathEq, pathOr, pipe, join } = require('ramda');
const { isNotNil, stubUndefined } = require('ramda-adjunct');
const { flow, getOr, get, nth } = require('lodash/fp');
const iniParser = require('ini-parser');
const ip = require('ip');

const { pathNotEq, mac2id } = require('../../../../../util');
const { StatusEnum } = require('../../../../../enums');
const { parseHwInterfaceConfig } = require('../interfaces/parsers');
const { deviceTypeFromModel, deviceCategoryFromType } = require('../../../../../feature-detection/common');

// parsePlatformId :: FullFirmwareVersion -> PlatformId
//     FullFirmwareVersion = String
//     PlatformId = String
const parsePlatformId = flow(match(/ER-(e\d+)\./), nth(1), defaultTo(null));

// parseHwDeviceName :: HwStatus -> DeviceName
//     HwStatus = Object
//     DeviceName = String
const parseHwDeviceName = getOr('ubnt', ['system', 'host-name']);

// parseHwGateway :: HwStatus -> Gateway
//     HwStatus = Object
//     Gateway = String
const parseHwGateway = getOr(null, ['system', 'gateway-address']);

/**
 * @param {CorrespondenceSysInfo} sysInfo
 * @return {CorrespondenceDevice}
 */
const edgeMaxDeviceStub = (sysInfo) => {
  const type = deviceTypeFromModel(sysInfo.model);
  const category = deviceCategoryFromType(type);

  return {
    identification: {
      id: sysInfo.deviceId,
      enabled: true,
      siteId: null,
      site: null,
      mac: sysInfo.mac,
      name: 'ubnt',
      serialNumber: null,
      firmwareVersion: sysInfo.firmwareVersion,
      platformId: sysInfo.platformId,
      model: sysInfo.model,
      updated: 0,
      authorized: false,
      type,
      category,
      ipAddress: null,
    },
    overview: {
      status: StatusEnum.Unauthorized,
      canUpgrade: false,
      isLocating: false,
      cpu: null,
      ram: null,
      voltage: null,
      temperature: null,
      signal: null,
      distance: null,
      biasCurrent: null,
      receivePower: null,
      receiveRate: null,
      receiveBytes: null,
      receiveErrors: null,
      receiveDropped: null,
      transmitPower: null,
      transmitRate: null,
      transmitBytes: null,
      transmitErrors: null,
      transmitDropped: null,
      lastSeen: 0,
      uptime: null,
      gateway: null,
    },
    meta: null,
    firmware: null,
    upgrade: null,
    mode: null,
    olt: null,
    onu: null,
    airmax: null,
    interfaces: [],
    unmsSettings: null,
  };
};

// eslint-disable-next-line valid-jsdoc
/**
 * Parses Erouter/OLT configuration into correspondence device
 *
 * @param {CorrespondenceSysInfo} sysInfo
 * @param {number} currentTimestamp
 * @param {DeviceFeatures} features
 * @param {ConfigMessage} hwDevice
 * @return {CorrespondenceDevice}
 */
const parseHwDevice = ({ currentTimestamp = Date.now(), features }, hwDevice) => {
  const deviceName = parseHwDeviceName(hwDevice.data);

  return {
    identification: {
      name: deviceName,
      updated: currentTimestamp,
    },
    overview: {
      lastSeen: currentTimestamp,
      gateway: parseHwGateway(hwDevice.data),
    },
    interfaces: parseHwInterfaceConfig({ features }, hwDevice.data.interfaces),
  };
};

const parseHwInterfacesMacs = (auxiliaries, hwInterfacesMacs) => {
  const iface = hwInterfacesMacs.data.find(allPass([
    pathEq(['type'], '0'),
    pathNotEq(['name'], 'lo'),
    pathNotEq(['mac'], '00:00:00:00:00:00'),
  ]));

  const mac = get(['mac'], iface);

  return {
    identification: {
      id: isNotNil(mac) ? mac2id(mac) : stubUndefined(),
      mac,
    },
  };
};

const parseCmRoutes = (auxiliaries, cmRoutes) => {
  const defaultRoute = cmRoutes.find(pathEq(['destination'], '0.0.0.0/0'));
  const gateway = getOr(null, 'gateway', defaultRoute);

  return {
    overview: {
      gateway,
    },
  };
};

const parseHwIpAddress = (auxiliaries, hwIpAddress) => {
  const rawAddr = pipe(pathOr([], ['data', 'output']), join('\n'))(hwIpAddress);
  const { config } = iniParser.parse(`[config]\n${rawAddr}`);
  const addr = pathOr('', ['addr'], config);
  const mask = pathOr('', ['mask'], config);

  let ipAddress = null;

  if (ip.isV4Format(addr) && ip.isV4Format(mask)) {
    const cidrIp = ip.subnet(config.addr, config.mask);
    ipAddress = `${addr}/${cidrIp.subnetMaskLength}`;
  }

  return {
    identification: {
      ipAddress,
    },
  };
};

module.exports = {
  parsePlatformId,
  edgeMaxDeviceStub,
  parseHwDevice,
  parseHwInterfacesMacs,
  parseCmRoutes,
  parseHwIpAddress,
};
