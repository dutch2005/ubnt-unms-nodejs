'use strict';

const redis = require('redis');
const bluebird = require('bluebird');
const { isNil, assignWith } = require('lodash');
const aguid = require('aguid');
const crypto = require('crypto');
const { eq, curry, constant, assign, partial, flow } = require('lodash/fp');
const { dissoc, assoc, ifElse, pathSatisfies } = require('ramda');
const { isNotNil } = require('ramda-adjunct');

const {
  MapsProviderEnum, MailServerTypeEnum, DeviceTransmissionProfileEnum, TimeFormatEnum, DateFormatEnum,
} = require('../../enums');

const host = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
const port = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;
const tapP = curry((fn, val) => Promise.resolve(fn(val)).then(constant(val)));
const redisClient = redis.createClient({ host, port });
bluebird.promisifyAll(redis.RedisClient.prototype);

const TypeEnum = Object.freeze({
  Nms: 'nms',
});

/* eslint-disable global-require */
const DB = (function iife() {
  const findTypeById = (db, type, id, fmap = JSON.parse) => db.getAsync(`${type}:${id}`).then(fmap);

  // TODO(jan.beseda@ubnt.com): remove once we stop support V1 socket protocol
  const toOldProtocolValidKey = key => key.replace(/\+/g, 'A').replace(/\//g, 'B');

  // configAssigner :: (a, b) -> a | b
  const configAssigner = (val, defaultVal) => (isNil(val) ? defaultVal : val);

  // getDefaultNmsSettings :: nmsConfig -> defaultNmsConfig
  const getDefaultNmsSettings = nms => ({
    isConfigured: false,
    instanceId: aguid(),
    aesKey: toOldProtocolValidKey(crypto.randomBytes(36).toString('base64')),
    autoBackups: true,
    smtp: { type: MailServerTypeEnum.NoSmtp },
    deviceLog: {},
    devicePingAddress: nms ? nms.hostname : null,
    devicePingIntervalNormal: 30000,
    devicePingIntervalOutage: 5000,
    deviceTransmissionProfile: DeviceTransmissionProfileEnum.High,
    allowLoggingToSentry: true,
    allowLoggingToLogentries: true,
    maps: {
      provider: MapsProviderEnum.OpenStreetMap,
      googleMapsApiKey: null,
    },
    outages: {
      defaultGracePeriod: 30000,
      upgradeGracePeriod: 300000,
      restartGracePeriod: 300000,
    },
    locale: {
      longDateFormat: {
        LT: TimeFormatEnum[0],
        LL: DateFormatEnum[0],
      },
    },
  });

  // getNms :: () -> Promise(Object)
  const getNms = () => findTypeById(redisClient, TypeEnum.Nms, TypeEnum.Nms)
    .then(nms => assignWith(nms || {}, getDefaultNmsSettings(nms), configAssigner));

  const insertType = (db, type, obj, fmap = JSON.stringify) =>
    db.setAsync(`${type}:${obj.id}`, fmap(obj))
      .then(tapP(() => db.hsetAsync('id2type', obj.id, type)))
      .then(eq('OK'));

  // insertNms :: Object -> Promise(Boolean)
  const insertNms = flow(assign({ id: TypeEnum.Nms }), partial(insertType, [redisClient, TypeEnum.Nms]));

  return {
    nms: {
      get: getNms,
      update: insertNms,
    },
  };
}());
/* eslint-disable global-require */

// hasGoogleMapsApiKey :: DbNms -> Boolean
//  DbNms = Object
const hasGoogleMapsApiKey = pathSatisfies(isNotNil, ['googleMapsApiKey']);

// hasGoogleMapsApiKey :: DbNms -> Boolean
//  DbNms = Object
const hasMapsGoogleMapsApiKey = pathSatisfies(isNotNil, ['maps', 'googleMapsApiKey']);


module.exports = {
  up() {
    return DB.nms.get()
      .then(ifElse(
        hasGoogleMapsApiKey,
        nms => assoc('maps', { provider: MapsProviderEnum.GoogleMaps, googleMapsApiKey: nms.googleMapsApiKey }, nms),
        nms => assoc('maps', { provider: MapsProviderEnum.OpenStreetMap, googleMapsApiKey: null }, nms)
      ))
      .then(dissoc('googleMapsApiKey'))
      .then(DB.nms.update);
  },
  down() {
    return DB.nms.get()
      .then(ifElse(
        hasMapsGoogleMapsApiKey,
        nms => assoc('googleMapsApiKey', nms.maps.googleMapsApiKey, nms),
        nms => assoc('googleMapsApiKey', null, nms)
      ))
      .then(dissoc('maps'))
      .then(DB.nms.update);
  },
};
