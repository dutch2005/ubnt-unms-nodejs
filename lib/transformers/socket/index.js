'use strict';

/**
 * @typedef {Object} CorrespondenceIncomingMessage
 * @property {Object} meta
 * @property {string} id
 * @property {string} type
 * @property {string} model
 * @property {Date} timestamp
 * @property {string} protocol
 * @property {?string} name
 * @property {*} data
 * @property {?string} error
 * @property {?number} errorCode
 */

/**
 * @typedef {Object} CorrespondenceOutgoingMessage
 * @property {string} id
 * @property {string} type
 * @property {string} socket
 * @property {Date} timestamp
 * @property {string} protocol
 * @property {?string} [name]
 * @property {*} [data]
 * @property {*} [request]
 */

/**
 * @typedef {Object} CorrespondenceSysInfo
 * @property {?string} mac
 * @property {?string} deviceId
 * @property {?string} model
 * @property {?string} platformId
 * @property {?string} firmwareVersion
 */
