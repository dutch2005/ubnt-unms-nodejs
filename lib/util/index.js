'use strict';

const path = require('path');
const boom = require('boom');
const aguid = require('aguid');
const {
  find, flatten, view, when, equals, pathEq, pathSatisfies, ifElse, toString, invoker, unless, split, times, assoc,
  anyPass, not, uniq, test,
} = require('ramda');
const { isNilOrEmpty } = require('ramda-adjunct');
const moment = require('moment-timezone');
const bluebird = require('bluebird');
const { accessAsync, statAsync, readdirAsync, removeAsync, readFileAsync } = bluebird.promisifyAll(require('fs-extra'));
const { Maybe } = require('monet');
const delay = require('delay');
const {
  truncate, flow, negate, isNull, isNil, isUndefined, isEmpty, isString, trim, curry, defaultTo, get,
  kebabCase, replace, constant, isPlainObject, isArray, isEqual, map, isError, range, identity,
  curryN, isNumber, first, clamp, getOr, parseInt, invoke, padCharsStart, flip, findLast,
  round,
} = require('lodash/fp');
const { SmartBuffer } = require('smart-buffer');
const url = require('url');
const ip = require('ip');

const config = require('../../config');
const { InterfaceIdentificationTypeEnum } = require('../enums');
const logging = require('../logging');


const BYTES_ABBREVIATIONS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const bytesFormatter = (value) => {
  if (value === 0 || !isNumber(value)) { return `0 ${first(BYTES_ABBREVIATIONS)}` }

  const unit = clamp(0, BYTES_ABBREVIATIONS.length - 1, Math.floor(Math.log(value) / Math.log(1000)));
  const result = (value / (1000 ** unit));

  return `${result} ${BYTES_ABBREVIATIONS[unit]}`;
};

// roundTo :: Precision -> Number
//     Precision = Number
const roundTo = curryN(2, flip(round));

// safeTrim :: (String | null) -> (String | null)
const safeTrim = value => Maybe.fromNull(value).filter(isString).map(trim).orSome(null);

// defaultToWhen :: (b -> Boolean) -> a -> b -> a | b
const defaultToWhen = curry((predicate, defaultValue, value) => when(predicate, constant(defaultValue), value));

/**
 * Same as gerOr but prefers default value before null
 *
 * @see defaultTo
 * @see getOr
 * @param {*} defaultValue
 * @param {string[]} objPath
 * @param {*} obj
 * @return {*}
 */
const getValueOr = (defaultValue, objPath, obj) => defaultTo(defaultValue, get(objPath, obj));

/**
 * Transform mac address to nms device id
 * String -> String
 */
const mac2id = aguid;

const viewOr = curry((defaultValue, lens, obj) => flow(view(lens), defaultTo(defaultValue))(obj));

const findOr = curry((defaultValue, fn, arr) => flow(find(fn), defaultTo(defaultValue))(arr));

const findLastOr = curry((defaultValue, fn, arr) => flow(findLast(fn), defaultTo(defaultValue))(arr));

const lensEq = curry((_lens, val, obj) => flow(view(_lens), equals(val))(obj));

const lensSatisfies = curry((pred, _lens, obj) => flow(view(_lens), pred, equals(true))(obj));

const resolveP = Promise.resolve.bind(Promise);

const isNotPlainObject = negate(isPlainObject);

const isNotArray = negate(isArray);

const isNotString = negate(isString);

const isNotNil = negate(isNil);

const isNotEqual = curryN(2, negate(isEqual));

const rejectP = Promise.reject.bind(Promise);

const allP = Promise.all.bind(Promise);

const isNotError = negate(isError);

const toError = when(negate(isError), flow(toString, Error));

const isBoom = pathEq(['isBoom'], true);

const isNotBoom = negate(isBoom);

const thenP = invoker(1, 'then');

const catchP = invoker(1, 'catch');

const attemptP = catchP(identity);

const pathNotSatisfies = curryN(3, negate(pathSatisfies));

const pathNotEq = curryN(3, negate(pathEq));

// calls effect until predicate is satisfied or max interactions are hit.
// callUntil :: Promise b => (a -> Boolean) -> Options -> (... -> a) -> b
//     Options = { interval: Number, max: Number }
const callUntil = curry((predicate, { interval = 1000, max = 5 } = {}, effect) => (...args) => {
  const thunk = () => effect(...args);
  const effectDissatisfied = () => rejectP(new Error('Effect did not satisfied the predicate'));
  const plan = queue => queue.then(thunk).then(when(predicate, rejectP)).then(delay(interval));

  return new Promise((resolve, reject) => {
    // generate plan for effect execution in advance.
    range(0, max).reduce(plan, resolveP()).then(effectDissatisfied).catch(ifElse(isError, reject, resolve));
  });
});

/**
 * Round to nearest multiple of factor
 *
 * @param {number} number
 * @param {number} factor
 * @example
 * // returns 21
 * roundTo(20, 7);
 * @example
 * // returns 45
 * roundTo(50, 15);
 * @return {number}
 */
function roundToMultiple(number, factor) {
  return factor * Math.floor((number / factor) + 0.5);
}

/**
 * Format device address to NMS address structure
 *
 * @param {string} cidr
 * @return {*}
 */
function normalizeDeviceAddress(cidr) {
  return { type: '', cidr: defaultToWhen(isEmpty, null, cidr) };
}

/**
 * Transform bin array 2 hex string.
 *
 * @param {Array} bytes
 * @return {string}
 */
function bin2hex(bytes) {
  let i;
  const hex = [];
  for (i = 0; i < bytes.length; i += 1) {
    /* eslint-disable */
    hex.push((bytes[i] >>> 4).toString(16));
    hex.push((bytes[i] & 0xF).toString(16));
    /* eslint-enable */
  }
  return hex.join('');
}

/**
 * Convert message to log line
 *
 * @name stringifySocketMessage
 * @param {*} message
 * @return string
 */
const stringifySocketMessage = flow(JSON.stringify, truncate({ length: 300000 }));


/**
 * Implementation of lodash/fp.tap function supporting promises.
 *
 * @param {Function} callback function returning promise
 * @param {*} value
 * @return {Promise}
 */
const tapP = curry((callback, value) =>
  Promise.resolve(callback(value))
    .then(() => value)
    .catch(error => Promise.reject(error))
);

const entityExistsCheck = curry((entityName, entity) => {
  if (isNil(entity)) {
    throw boom.notFound(`${entityName} not found`);
  }
  return true;
});

const weightedAverage = (a, wa, b, wb) => ((a * wa) + (b * wb)) / (wa + wb);

const toMs = curry((type, num) => moment.duration(num, type).asMilliseconds());

const isNotNull = negate(isNull);

const isNotUndefined = negate(isUndefined);

const isNotEmpty = negate(isEmpty);

const normalize = stringValue => stringValue.normalize('NFD');

const removeDiacritics = replace(/[\u0300-\u036f]/g, '');

const toCanonicalKebabCase = flow(String, normalize, removeDiacritics, kebabCase);

/**
 * Format interface type from interface name
 *
 * @param name
 * @return {string}
 */

const formatInterfaceType = (name) => {
  if (/^eth[0-9]*\./.test(name)) {
    return InterfaceIdentificationTypeEnum.Vlan;
  }
  return name.replace(/[0-9]/g, '');
};

/**
 * @param {string} deviceId
 * @param {Array} deviceLists
 * @return {Object}
 */
const findDeviceById = (deviceId, deviceLists) =>
  find(pathEq(['identification', 'id'], deviceId))(deviceLists);

/**
 * @param {string} deviceMacAddress
 * @param {Array} deviceLists
 * @return {Object}
 */
const findDeviceByMac = (deviceMacAddress, deviceLists) =>
flow(flatten, find(pathEq(['identification', 'mac'], deviceMacAddress)))(deviceLists);

const findCommDevice = (deviceId, devices) =>
  Promise.resolve(findDeviceById(deviceId, devices)).then(defaultTo(null));

// cleanFiles :: Number -> String
function cleanFiles(ttl, dir) {
  logging.debug(`Cleaning directory ${dir}`);
  const historyLimit = moment().subtract(ttl, 'ms');

  // canCleanFile :: Object -> Boolean
  const canCleanFile = (stats) => {
    const createdTime = get('ctime', stats);
    return stats.isFile() && createdTime && moment(createdTime).isBefore(historyLimit);
  };

  // cleanFile :: String -> Promise
  const cleanFile = (filePath) => {
    logging.debug(`Deleting old file ${filePath}`);
    return removeAsync(filePath);
  };

  // handleCleanFileError :: Error -> void
  const handleCleanFileError = (error) => {
    if (error.code !== 'ENOENT') {
      logging.error(`Failed to clean ${dir}`, error);
    } else {
      logging.info(`Cannot clean ${error.path} - does not exist`);
    }
  };

  return accessAsync(dir)
    .then(() => readdirAsync(dir))
    .then(map(fileName => path.join(dir, fileName)))
    .then(map(filePath => statAsync(filePath)
      .then(when(canCleanFile, () => cleanFile(filePath)))
    ))
    .then(Promise.all.bind(Promise))
    .catch(handleCleanFileError);
}

const getPagingByQuery = (query) => {
  const { count: limit = 50, page = 1 } = query;
  const offset = (page - 1) * limit;
  return { offset, limit, page };
};

const getPagination = (aggs, level, count, requestPage) => {
  const total = getOr(0, [`${level}Count`], aggs);
  const pages = Math.ceil(aggs.allCount / count);
  const page = Math.min(requestPage, pages);

  return { total, count, pages, page };
};

const readFile = curry(filePath => readFileAsync(filePath)
  .catch((error) => {
    logging.error(`Failed to read file: ${filePath}`, error);
    throw error;
  }));

const macToBuffer = unless(isNil, flow(
  split(':'),
  map(parseInt(16)),
  values => values.reduce((buff, value) => buff.writeUInt8(value), SmartBuffer.fromSize(6)),
  invoke('toBuffer')
));

const bufferToMac = (buff) => {
  const sb = SmartBuffer.fromBuffer(buff);
  return times(() => padCharsStart('0', 2, sb.readUInt8().toString(16)), 6).join(':');
};

const formatUnmsHostname = hostname => flow(
  url.parse,
  assoc('port', config.publicHttpsPort),
  assoc('hostname', hostname),
  assoc('protocol', 'https'),
  url.format
)('');

const getUnmsHostname = nms => (isUndefined(nms.hostname)
  ? config.defaultNmsHostname
  : formatUnmsHostname(nms.hostname)
);

const cidrToIp = cidr => String(cidr).split('/')[0];

const isMomentOrDate = anyPass([moment.isMoment, moment.isDate]);

const convertIPv4MappedAddress = when(
  test(/^(0:0:0:0:0:FFFF:|::FFFF:)(\d{1,3}\.){3,3}\d{1,3}$/i),
  replace(/^(0:0:0:0:0:FFFF:|::FFFF:)/i, '')
);

const getClientIpFromRequest = (request, onlyIp = false) => {
  const xRealIp = get(['headers', 'x-real-ip'], request);
  const xForwardedForString = get(['headers', 'x-forwarded-for'], request);
  const remoteAddress = get(['connection', 'remoteAddress'], request);

  const xForwardedFor = isNilOrEmpty(xForwardedForString) ? [] : uniq(xForwardedForString.replace(/ /g, '').split(','));

  // remove all private IP addresses up to the first public IP, if there is one
  if (xForwardedFor.find(ip.isPublic)) {
    while (xForwardedFor.length > 1 && ip.isPrivate(xForwardedFor[0])) {
      xForwardedFor.shift();
    }
  }

  let clientIp = '';
  let proxyIp = null;

  if (not(isNilOrEmpty(remoteAddress))) { clientIp = remoteAddress }
  if (not(isNilOrEmpty(xRealIp))) { clientIp = xRealIp }

  // prefer the leftmost IP address from xForwardedFor as client's real IP
  if (xForwardedFor.length > 0) {
    clientIp = xForwardedFor[0];
    xForwardedFor.shift();
  }

  // prefer the last address from xForwardedFor as the (via...) address
  // (we want to show the last proxy server that the request came from)
  if (xForwardedFor.length > 0) {
    proxyIp = xForwardedFor[xForwardedFor.length - 1];
  }

  clientIp = convertIPv4MappedAddress(clientIp);
  if (isString(proxyIp)) {
    proxyIp = convertIPv4MappedAddress(proxyIp);
  }

  return (isNilOrEmpty(proxyIp) || onlyIp) ? clientIp : `${clientIp} (via ${proxyIp})`;
};

const partitionToMaxSize = curry((maxSize, array) => {
  const grouped = [];
  const length = Math.ceil(array.length / maxSize);

  if (length === 0) {
    return grouped;
  }

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < length - 1; i++) {
    const sIndex = i * maxSize;
    const lIndex = sIndex + maxSize;

    grouped.push(array.slice(sIndex, lIndex));
  }

  grouped.push(array.slice((length - 1) * maxSize, Infinity));

  return grouped;
});


module.exports = {
  allP,
  attemptP,
  bin2hex,
  bufferToMac,
  bytesFormatter,
  callUntil,
  catchP,
  cidrToIp,
  cleanFiles,
  defaultToWhen,
  entityExistsCheck,
  findCommDevice,
  findDeviceById,
  findDeviceByMac,
  findLastOr,
  findOr,
  formatInterfaceType,
  getPagination,
  getPagingByQuery,
  getUnmsHostname,
  getValueOr,
  isBoom,
  isNotArray,
  isNotBoom,
  isNotEmpty,
  isNotEqual,
  isNotError,
  isNotNil,
  isNotNull,
  isNotPlainObject,
  isNotString,
  isNotUndefined,
  lensEq,
  lensSatisfies,
  mac2id,
  macToBuffer,
  normalizeDeviceAddress,
  pathNotEq,
  pathNotSatisfies,
  readFile,
  rejectP,
  resolveP,
  roundTo,
  roundToMultiple,
  safeTrim,
  stringifySocketMessage,
  tapP,
  thenP,
  toCanonicalKebabCase,
  toError,
  toMs,
  viewOr,
  weightedAverage,
  isMomentOrDate,
  getClientIpFromRequest,
  partitionToMaxSize,
};
