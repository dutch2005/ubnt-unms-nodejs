'use strict';

const { isPlainObject, isNumber, isString, isNull, defaultTo, curry, flow, find, getOr } = require('lodash/fp');
const { evolve, converge, assoc, applySpec, assocPath } = require('ramda');
const { list } = require('ramda-adjunct');
const joi = require('joi');
const base64url = require('base64-url');

const { META_KEY } = require('../../transformers');
const { InvalidMessageError } = require('../errors');
const { MessageNameEnum, MessageTypeEnum } = require('../../transformers/socket/enums');

const MINIMUM_KEY_LENGTH = 36;

/**
 * @typedef {Object} CorrespondenceSysInfo
 * @property {?string} mac
 * @property {?string} deviceId
 * @property {?string} model
 * @property {?string} platformId
 * @property {?string} firmwareVersion
 */

/**
 * @function parseGenericMessage
 * @param {Object} schema
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseGenericMessage = curry((schema, incomingMessage) => {
  const { payload, meta } = incomingMessage;

  const result = schema !== null
    ? joi.attempt(payload, schema)
    : payload;

  return {
    [META_KEY]: { original: incomingMessage },
    meta,
    id: result.id,
    type: result.type,
    model: result.model,
    timestamp: result.timestamp,
    protocol: result.protocol,
    name: defaultTo(MessageNameEnum.Unknown, result.name),
    data: defaultTo(null, result.data),
    error: defaultTo(null, result.error),
    errorCode: defaultTo(null, result.errorCode),
  };
});

/**
 * @function parseConnectMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseConnectMessage = parseGenericMessage(
  joi.object().keys({
    id: joi.string().required(),
    type: joi.string().equal(MessageTypeEnum.Event).required(),
    model: joi.string().required(),
    udapi: joi.string().optional(),
    name: joi.string().equal(MessageNameEnum.Connect).required(),
    timestamp: joi.date().timestamp().required(),
    protocol: joi.string().valid(['2.0']).required(),
    data: joi.object().keys({}).unknown().optional(),
  })
);

/**
 * @function parseEventMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseEventMessage = parseGenericMessage(
  joi.object().keys({
    id: joi.string().required(),
    type: joi.string().equal(MessageTypeEnum.Event).required(),
    model: joi.string().required(),
    name: joi.string().optional(),
    timestamp: joi.date().timestamp().required(),
    protocol: joi.string().valid(['1.0', '2.0']).required(),
    data: joi.object().unknown().optional(),
  })
);

/**
 * @function parseRpcErrorMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseRpcErrorMessage = flow(
  parseGenericMessage(
    joi.object().keys({
      id: joi.string().required(),
      type: joi.string().equal(MessageTypeEnum.Rpc).required(),
      name: joi.string().required(),
      model: joi.string().required(),
      timestamp: joi.date().timestamp().required(),
      protocol: joi.string().valid(['1.0', '2.0']).required(),
      error: joi.string().required(),
      errorCode: joi.number().integer().positive().required(),
      data: joi.string().equal('nok').required(),
    })
  ),
  assoc('type', MessageTypeEnum.RpcError)
);

/**
 * @function parseRpcMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseRpcMessage = parseGenericMessage(
  joi.object().keys({
    id: joi.string().required(),
    type: joi.string().equal(MessageTypeEnum.Rpc).required(),
    name: joi.string().required(),
    model: joi.string().required(),
    timestamp: joi.date().timestamp().required(),
    socket: joi.string().optional(),
    protocol: joi.string().valid(['1.0', '2.0']).required(),
    data: joi.any().required(),
  })
);

/**
 * @function parseRpcMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseCmdMessage = flow(
  parseRpcMessage,
  assoc('type', MessageTypeEnum.Cmd)
);

/**
 * @function parseSysInfoMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseSysInfoMessage = flow(
  parseGenericMessage(
    joi.object().keys({
      id: joi.string().required(),
      type: joi.string().equal(MessageTypeEnum.Rpc).required(),
      name: joi.string().equal('getSysInfo').required(),
      model: joi.string().required(),
      timestamp: joi.date().timestamp().required(),
      socket: joi.string().optional(),
      protocol: joi.string().valid(['1.0', '2.0']).required(),
      data: joi.object().keys({
        mac: joi.string().optional(), // only for AirMax
        version: joi.string().optional(), // only for AirMax with newer version of udapi-bridge
        boardname: joi.string().optional(), // only for AirMax with newer version of udapi-bridge
        hostname: joi.string().optional(), // only for Eswitch with newer version of udapi-bridge
        success: joi.string().valid(['1', '0']).optional(), // only EdgeRouters and OLTs
        output: joi.object().keys({ // only EdgeRouters and OLTs
          sw_ver: joi.string().required(),
        }).unknown().optional(),
      }).unknown().required(),
    })
  ),
  evolve({
    data: applySpec({
      mac: getOr(null, ['mac']),
      hostname: getOr(null, ['hostname']),
      version: converge(flow(list, find(isString), defaultTo(null)), [
        getOr(null, ['version']),
        getOr(null, ['output', 'sw_ver']),
      ]),
    }),
  }),
  (message) => {
    if (isString(message.meta.mac) && isNull(message.data.mac)) {
      return assocPath(['data', 'mac'], message.meta.mac, message);
    }

    return message;
  }
);

/**
 * @function parseIncomingMessage
 * @param {Object} incomingMessage
 * @return {CorrespondenceIncomingMessage}
 */
const parseIncomingMessage = (incomingMessage) => {
  if (!isPlainObject(incomingMessage)) {
    throw new InvalidMessageError();
  }

  const { payload } = incomingMessage;

  if (payload.type === MessageTypeEnum.Event) {
    switch (payload.name) {
      case MessageNameEnum.Connect:
        return parseConnectMessage(incomingMessage);
      default:
        return parseEventMessage(incomingMessage);
    }
  } else if (payload.type === MessageTypeEnum.Rpc) {
    if (isString(payload.error) && isNumber(payload.errorCode)) {
      return parseRpcErrorMessage(incomingMessage);
    }
    switch (payload.name) {
      case MessageNameEnum.GetSysInfo:
        return parseSysInfoMessage(incomingMessage);
      case MessageNameEnum.Cmd:
        return parseCmdMessage(incomingMessage);
      default:
        return parseRpcMessage(incomingMessage);
    }
  }

  return parseGenericMessage(null, incomingMessage);
};

/**
 * @param {Object} auxiliaries
 * @param {Buffer} auxiliaries.key
 * @param {CorrespondenceIncomingMessage} connectMessage
 * @return {Object}
 */
const parseConnectMessageReply = (auxiliaries, connectMessage) => {
  const { key } = auxiliaries;

  let validKey = key;

  /*
    Because of historical reasons we add padding to make key at least MINIMUM_KEY_LENGTH long
    otherwise it's rejected by EdgeRouters and possibly by other devices as well.
   */
  const lengthDiff = MINIMUM_KEY_LENGTH - key.length;
  if (lengthDiff > 0) {
    validKey = Buffer.concat([
      key,
      Buffer.alloc(lengthDiff, 0),
    ]);
  }

  const data = {
    key: base64url.escape(validKey.toString('base64')),
  };

  return {
    id: connectMessage.id,
    type: MessageTypeEnum.Event,
    name: MessageNameEnum.Connect,
    model: connectMessage.model,
    meta: connectMessage.meta,
    data,
  };
};

module.exports = {
  parseGenericMessage,
  parseIncomingMessage,
  parseConnectMessageReply,
};
