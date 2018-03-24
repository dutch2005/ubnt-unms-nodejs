'use strict';

const { times, padCharsStart } = require('lodash/fp');
const ip = require('ip');

const { liftEither } = require('../../transformers');
const { parseHwDiscoveryDevice } = require('../../transformers/discovery/device/parsers');
const { mac2id } = require('../../util');

const PacketItemsEnum = {
  MAC_ADDRESS: 0x01,
  IP_INFO: 0x02,
  FIRMWARE_VERSION: 0x03,
  UPTIME: 0x0A,
  HOSTNAME: 0x0B,
  MODEL: 0x0C,
  ESSID: 0x0D,
  DESCRIPTION: 0x14,
};

const CMD_INFO = 0;

const extractMacAddress = buff =>
  times(() => padCharsStart('0', 2, buff.readUInt8().toString(16)), 6).join(':');

/**
 * Device info parsed from the packet
 *
 * @typedef {Object} HwDiscoveryDevice
 * @property {string[]} ids UUID
 * @property {Array.<{ ip: string, mac: string }>} addresses
 * @property {string} mac
 * @property {string} ip
 * @property {string} firmwareVersion
 * @property {string} hostname
 * @property {string} model
 * @property {string} essid
 * @property {string} description
 * @property {number} uptime
 */

/**
 * @param {SmartBuffer} buff
 * @param {{ address: string, family: string, port: number }} info
 * @return {Either.<Error, CorrespondenceDiscoveryDevice>}
 */
const parse = (buff, info) => {
  buff.readUInt8(); // cmd
  buff.readUInt16BE(); // dataLength

  /**
   * @type {HwDiscoveryDevice}
   */
  const hwDiscoveryDevice = {
    ip: info.address,
    addresses: [],
  };

  const ids = new Set();

  while (buff.remaining() > 0) {
    const itemId = buff.readUInt8();
    const length = buff.readUInt16BE();

    // some blocks have zero length, skip them
    if (length === 0) { continue } // eslint-disable-line no-continue

    switch (itemId) {
      case PacketItemsEnum.MAC_ADDRESS:
        if (length === 6) {
          hwDiscoveryDevice.mac = extractMacAddress(buff);
          ids.add(mac2id(hwDiscoveryDevice.mac));
        } else {
          buff.readBuffer(length);
        }
        break;
      case PacketItemsEnum.IP_INFO:
        if (length === 10) {
          const mac = extractMacAddress(buff);
          hwDiscoveryDevice.addresses.push({
            mac,
            ip: ip.fromLong(buff.readUInt32BE()),
          });
          ids.add(mac2id(mac));
        } else {
          buff.readBuffer(length);
        }
        break;
      case PacketItemsEnum.FIRMWARE_VERSION:
        hwDiscoveryDevice.firmwareVersion = buff.readString(length);
        break;
      case PacketItemsEnum.HOSTNAME:
        hwDiscoveryDevice.hostname = buff.readString(length);
        break;
      case PacketItemsEnum.MODEL:
        hwDiscoveryDevice.model = buff.readString(length);
        break;
      case PacketItemsEnum.ESSID:
        hwDiscoveryDevice.essid = buff.readString(length);
        break;
      case PacketItemsEnum.DESCRIPTION:
        hwDiscoveryDevice.description = buff.readString(length);
        break;
      case PacketItemsEnum.UPTIME:
        hwDiscoveryDevice.uptime = buff.readUInt32BE();
        break;
      default: {
        buff.skip(length);
      }
    }
  }

  buff.moveTo(0); // reset buffer position
  hwDiscoveryDevice.ids = Array.from(ids);
  return parseHwDiscoveryDevice({}, hwDiscoveryDevice);
};

/**
 * @param {SmartBuffer} buff
 * @return {boolean}
 */
const isPacketValid = (buff) => {
  if (buff.length < 16) { return false }

  const version = buff.readUInt8(0);
  const cmd = buff.readUInt8();
  const dataLength = buff.readUInt16BE();
  const expectedLength = buff.remaining();

  buff.moveTo(0); // reset buffer position

  return (version === 1 || version === 2) &&
    cmd === CMD_INFO &&
    dataLength === expectedLength;
};

/**
 * @param {SmartBuffer} buff
 * @param {{ address: string, family: string, port: number }} info
 * @return {Either.<Error, CorrespondenceDiscoveryDevice>}
 */
const parsePacket = (buff, info) => {
  if (buff.length < 16) { throw new Error('Invalid packet') }

  const version = buff.readUInt8(0);

  switch (version) {
    case 1:
    case 2:
      return parse(buff, info);
    default:
      throw new Error('Unknown packet version');
  }
};

module.exports = {
  isPacketValid,
  parsePacket,

  safeParsePacket: liftEither(2, parsePacket),
};
