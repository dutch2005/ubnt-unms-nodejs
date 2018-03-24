'use strict';

const iniParser = require('ini-parser');
const {
  isString, eq, isPlainObject, toLower, join, drop, get, getOr, flow, constant, isArray, first, nth, replace,
} = require('lodash/fp');
const { pathSatisfies, evolve, applySpec, when } = require('ramda');

const { mac2id } = require('../../../../../util');
const { MessageTypeEnum } = require('../../../../../transformers/socket/enums');
const { modelToPlatformIds } = require('../../../../../feature-detection/firmware');
const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');
const { MessageNameEnum } = require('../../enums');

const isSystemStatsMessage = pathSatisfies(isPlainObject, ['data', 'system-stats']);
const isSystemUpgradeStatsMessage = pathSatisfies(isPlainObject, ['data', 'system-upgrade-stats']);
const isConfigChangeMessage = pathSatisfies(eq('ended'), ['data', 'config-change', 'commit']);

/**
 * @function parseConfigMessage
 * @param {CorrespondenceIncomingMessage} systemStatsMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseConfigMessage = evolve({
  name: constant(MessageNameEnum.GetConfig),
  data: flow(
    get('output'),
    drop(1), // first item is a name
    join('\n'),
    iniParser.parse
  ),
});

/**
 * @function parseDeviceIpMessage
 * @param {CorrespondenceIncomingMessage} systemStatsMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseDeviceIpMessage = evolve({
  name: constant(MessageNameEnum.GetDeviceIp),
  data: flow(
    get('output'),
    nth(1) // take second element
  ),
});


/**
 * @function parseSystemStatsMessage
 * @param {CorrespondenceIncomingMessage} systemStatsMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseSystemStatsMessage = evolve({
  name: constant(MessageNameEnum.SystemStats),
  data: get('system-stats'),
});

/**
 * @function parseConfigChangeMessage
 * @param {CorrespondenceIncomingMessage} configChangeMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseConfigChangeMessage = evolve({
  name: constant(MessageNameEnum.ConfigChange),
});

/**
 * @function parseUpgradeStatsMessage
 * @param {CorrespondenceIncomingMessage} configChangeMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseSystemUpgradeStatsMessage = evolve({
  name: constant(MessageNameEnum.SystemUpgradeStats),
  data: get('system-upgrade-stats'),
});

/**
 * @function parseSysInfoMessage
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {CorrespondenceSysInfo}
 */
const parseSysInfoMessage = applySpec({
  deviceId: flow(getOr(null, ['data', 'mac']), when(isString, flow(toLower, mac2id))),
  mac: getOr(null, ['data', 'mac']),
  model: getOr(null, ['model']),
  firmwareVersion: flow(getOr(null, ['data', 'version']), replace(/\.\d+$/, ''), parseCommFirmwareVersion),
  platformId: flow(getOr(null, ['model']), modelToPlatformIds, when(isArray, first)), // only one platform per model
});

const parseIncomingMessage = (incomingMessage) => {
  if (incomingMessage.type === MessageTypeEnum.Cmd) {
    const name = getOr(null, ['data', 'output', 0], incomingMessage);

    switch (name) {
      case MessageNameEnum.GetConfig:
        return parseConfigMessage(incomingMessage);
      case MessageNameEnum.GetDeviceIp:
        return parseDeviceIpMessage(incomingMessage);
      default:
      // do nothing
    }
  }

  if (incomingMessage.type === MessageTypeEnum.Event) {
    if (isSystemStatsMessage(incomingMessage)) {
      return parseSystemStatsMessage(incomingMessage);
    }

    if (isConfigChangeMessage(incomingMessage)) {
      return parseConfigChangeMessage(incomingMessage);
    }

    if (isSystemUpgradeStatsMessage(incomingMessage)) {
      return parseSystemUpgradeStatsMessage(incomingMessage);
    }
  }

  return incomingMessage;
};

module.exports = {
  parseSysInfoMessage,
  parseIncomingMessage,
};
