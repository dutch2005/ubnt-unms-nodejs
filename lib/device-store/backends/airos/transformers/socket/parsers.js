'use strict';

const iniParser = require('ini-parser');
const { isString, toLower, join, drop, get, getOr, flow, constant, head, trim } = require('lodash/fp');
const { evolve, applySpec, when, tryCatch } = require('ramda');
const { isNotNull, stubNull } = require('ramda-adjunct');

const { mac2id } = require('../../../../../util');
const { MessageTypeEnum } = require('../../../../../transformers/socket/enums');
const { parsePlatformId } = require('../../../../../transformers/device/airmax/parsers');
const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');
const { MessageNameEnum } = require('../../enums');

// parseHwFirmwareVersion :: HwStatus -> FirmwareVersion
//     HwStatus = Object
//     FirmwareVersion = String
const parseHwFirmwareVersion = flow(
  getOr(null, ['data', 'version']),
  parseCommFirmwareVersion
);

// parseHwFirmwareVersion :: HwStatus -> PlatformId
//     HwStatus = Object
//     PlatformId = String
const parseHwPlatformId = flow(
  getOr(null, ['data', 'version']),
  when(isNotNull, parsePlatformId)
);

/**
 * @function parseSysInfoMessage
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {CorrespondenceSysInfo}
 */
const parseSysInfoMessage = applySpec({
  deviceId: flow(getOr(null, ['data', 'mac']), when(isString, flow(toLower, mac2id))),
  mac: getOr(null, ['data', 'mac']),
  model: getOr(null, ['model']),
  firmwareVersion: parseHwFirmwareVersion,
  platformId: parseHwPlatformId,
});

const parseConfigMessage = evolve({
  name: constant(MessageNameEnum.Config),
  data: flow(
    get('output'),
    drop(1), // first item is a name
    join('\n'),
    iniParser.parse
  ),
});

const parseAirViewMessage = evolve({
  name: constant(MessageNameEnum.AirView),
  data: flow(
    get('output'),
    drop(1), // first item is a name
    join('\n'),
    tryCatch(JSON.parse, stubNull) // might not be available
  ),
});

const parseInterfaceStatsMessage = evolve({
  name: constant(MessageNameEnum.InterfaceStats),
  data: flow(
    get('output'),
    drop(1), // first item is a name
    join('\n'),
    JSON.parse
  ),
});

const parseConfigCheckMessage = evolve({
  name: constant(MessageNameEnum.ConfigCheck),
  data: flow(
    get('output'),
    drop(1), // first item is a name
    head, // next item is the checkSum
    trim
  ),
});

/**
 * @function parseIncomingMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseIncomingMessage = (incomingMessage) => {
  if (incomingMessage.type === MessageTypeEnum.Cmd) {
    const name = getOr(null, ['data', 'output', 0], incomingMessage);

    switch (name) {
      case MessageNameEnum.Config:
        return parseConfigMessage(incomingMessage);
      case MessageNameEnum.ConfigCheck:
        return parseConfigCheckMessage(incomingMessage);
      case MessageNameEnum.AirView:
        return parseAirViewMessage(incomingMessage);
      case MessageNameEnum.InterfaceStats:
        return parseInterfaceStatsMessage(incomingMessage);
      default:
      // do nothing
    }
  }

  return incomingMessage;
};

module.exports = {
  parseSysInfoMessage,
  parseIncomingMessage,
};
