'use strict';

const { isString, toLower, reduce, getOr, flow, identity, constant, T } = require('lodash/fp');
const { assocPath, evolve, applySpec, when, pathEq, defaultTo, cond } = require('ramda');

const { mac2id } = require('../../../../../util');
const { FirmwarePlatformIdEnum } = require('../../../../../enums');
const { MessageNameEnum } = require('../../../../backends/openwrt/enums');
const { MessageTypeEnum } = require('../../../../../transformers/socket/enums');
const { parseCommFirmwareVersion } = require('../../../../../transformers/semver/parsers');

/**
 * @function parseSysInfoMessage
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {CorrespondenceSysInfo}
 */
const parseSysInfoMessage = applySpec({
  deviceId: flow(getOr(null, ['data', 'mac']), when(isString, flow(toLower, mac2id))),
  mac: getOr(null, ['data', 'mac']),
  model: getOr(null, ['model']),
  firmwareVersion: flow(getOr(null, ['data', 'version']), parseCommFirmwareVersion, defaultTo('0.0.0')),
  platformId: constant(FirmwarePlatformIdEnum.ACB),
});

/**
 * @function parseUbusMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseUbusMessage = identity;

/**
 * @function parseUbusBatchMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseUbusBatchMessage = evolve({
  data: reduce((accumulator, { id, response }) => assocPath([id], response, accumulator), {}),
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
 * @function parseRpcMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseRpcMessage = cond([
  [pathEq(['name'], MessageNameEnum.Ubus), parseUbusMessage],
  [pathEq(['name'], MessageNameEnum.UbusBatch), parseUbusBatchMessage],
  [T, identity],
]);

/**
 * @function parseEventMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseEventMessage = cond([
  [pathEq(['data', 'type'], MessageNameEnum.ConfigChange), parseConfigChangeMessage],
  [T, identity],
]);

/**
 * @function parseIncomingMessage
 * @param {CorrespondenceIncomingMessage} incomingMessage
 * @return {Object}
 */
const parseIncomingMessage = cond([
  [pathEq(['type'], MessageTypeEnum.Rpc), parseRpcMessage],
  [pathEq(['type'], MessageTypeEnum.Event), parseEventMessage],
  [T, identity],
]);

module.exports = {
  parseSysInfoMessage,
  parseIncomingMessage,
};
