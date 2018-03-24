'use strict';

const {
  isPlainObject, eq, get, constant, isString, map, flow, drop, split, zipObject, getOr, assign, nth, defaultTo,
} = require('lodash/fp');
const { pathSatisfies, pathEq, evolve, applySpec, when } = require('ramda');

const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');
const { parsePlatformId } = require('../device/parsers');
const { mac2id } = require('../../../../../util');
const { MessageTypeEnum } = require('../../../../../transformers/socket/enums');
const { MessageNameEnum } = require('../../enums');

const isInterfacesMessage = pathSatisfies(isPlainObject, ['data', 'interfaces']);
const isSystemStatsMessage = pathSatisfies(isPlainObject, ['data', 'system-stats']);
const isPonStatsMessage = pathSatisfies(isPlainObject, ['data', 'pon-stats']);
const isConfigChangeMessage = pathSatisfies(eq('ended'), ['data', 'config-change', 'commit']);

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
  parsePlatformId
);

/**
 * @function parseSysInfoMessage
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {CorrespondenceSysInfo}
 */
const parseSysInfoMessage = applySpec({
  deviceId: flow(getOr(null, ['data', 'mac']), when(isString, mac2id)),
  mac: getOr(null, ['data', 'mac']),
  model: getOr(null, ['model']),
  firmwareVersion: parseHwFirmwareVersion,
  platformId: parseHwPlatformId,
});

/**
 * @function parseGetMessage
 * @param {CorrespondenceIncomingMessage} configMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseGetMessage = evolve({
  data: get('GET'),
});

/**
 * @function parseVyattaError
 * @param {string} errorMessage
 * @return {string}
 */
const parseVyattaError = flow(
  String,
  split('\n'),
  nth(1),
  defaultTo('Unknown error')
);

/**
 * @function parseSetConfigMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseSetConfigMessage = (incomingMessage) => {
  if (pathEq(['data', 'COMMIT', 'failure'], '1', incomingMessage)) {
    return assign(incomingMessage, {
      error: parseVyattaError(get(['data', 'COMMIT', 'error'], incomingMessage)),
      errorCode: 1,
    });
  }

  if (pathEq(['data', 'SET', 'failure'], '1', incomingMessage)) {
    return assign(incomingMessage, {
      error: parseVyattaError(get(['data', 'SET', 'error'], incomingMessage)),
      errorCode: 1,
    });
  }

  if (pathEq(['data', 'DELETE', 'failure'], '1', incomingMessage)) {
    return assign(incomingMessage, {
      error: parseVyattaError(get(['data', 'DELETE', 'error'], incomingMessage)),
      errorCode: 1,
    });
  }

  return incomingMessage;
};

/**
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseSetOnuConfigMessage = (incomingMessage) => {
  if (pathEq(['data', 'SET_ONUCFG', 'failure'], '1', incomingMessage)) {
    return assign(incomingMessage, {
      error: getOr('Unknown error', ['data', 'SET_ONUCFG', 'error'], incomingMessage),
      errorCode: 1,
    });
  }

  return incomingMessage;
};

/**
 * @function parseInterfacesMessage
 * @param {CorrespondenceIncomingMessage} interfacesMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseInterfacesMessage = evolve({
  name: constant(MessageNameEnum.Interfaces),
  data: get('interfaces'),
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
 * @function parsePonStatsMessage
 * @param {CorrespondenceIncomingMessage} systemStatsMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parsePonStatsMessage = evolve({
  name: constant(MessageNameEnum.PonStats),
});

/**
 * @function parseConfigChangeMessage
 * @param {CorrespondenceIncomingMessage} configChangeMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseConfigChangeMessage = evolve({
  name: constant(MessageNameEnum.ConfigChange),
});

const parseInterfacesMacsMessage = evolve({
  name: constant(MessageNameEnum.InterfaceMacs),
  data: flow(
    get('output'),
    drop(1), // first item is a name
    map(flow(split(' '), zipObject(['name', 'type', 'mac'])))
  ),
});

/**
 * @function parseIncomingMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseIncomingMessage = (incomingMessage) => {
  if (incomingMessage.type === MessageTypeEnum.Rpc) {
    switch (incomingMessage.name) {
      case MessageNameEnum.GetConfig:
      case MessageNameEnum.GetServices:
      case MessageNameEnum.GetSystem:
      case MessageNameEnum.GetInterfaces:
        return parseGetMessage(incomingMessage);
      case MessageNameEnum.SetConfig:
        return parseSetConfigMessage(incomingMessage);
      case MessageNameEnum.SetOnuConfig:
        return parseSetOnuConfigMessage(incomingMessage);
      default:
        // do nothing
    }
  }


  if (incomingMessage.type === MessageTypeEnum.Cmd) {
    const name = getOr(null, ['data', 'output', 0], incomingMessage);

    switch (name) {
      case MessageNameEnum.InterfaceMacs:
        return parseInterfacesMacsMessage(incomingMessage);
      default:
      // do nothing
    }
  }

  if (incomingMessage.type === MessageTypeEnum.Event) {
    if (isInterfacesMessage(incomingMessage)) {
      return parseInterfacesMessage(incomingMessage);
    }

    if (isSystemStatsMessage(incomingMessage)) {
      return parseSystemStatsMessage(incomingMessage);
    }

    if (isPonStatsMessage(incomingMessage)) {
      return parsePonStatsMessage(incomingMessage);
    }

    if (isConfigChangeMessage(incomingMessage)) {
      return parseConfigChangeMessage(incomingMessage);
    }
  }

  return incomingMessage;
};

module.exports = {
  parseIncomingMessage,
  parseSysInfoMessage,
};
