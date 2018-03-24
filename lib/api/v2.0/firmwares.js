'use strict';

const aguid = require('aguid');
const { times, values, flow, get, /* keyBy, identity, has, __, */eq } = require('lodash/fp');
const lodash = require('lodash');
const { contains } = require('ramda');
const { Chance } = require('chance');
const moment = require('moment-timezone');

const { registerPlugin } = require('../../util/hapi');
const { modelsForPlatformId } = require('../../feature-detection/firmware');
const { parseSemver } = require('../../transformers/semver/parsers');
const { FirmwareOriginEnum, FirmwarePlatformIdEnum } = require('../../enums');
const { unmsGuiUrl } = require('../../settings');
const validation = require('../../validation');

// chance generator instance.
const chance = new Chance();

const possibleOrigins = values(FirmwareOriginEnum);
const possiblePlatformIds = values(FirmwarePlatformIdEnum);

const toFirmwareKey = get(['identification', 'id']);

const fileExtForPlatform = (platformId) => {
  switch (platformId) {
    case FirmwarePlatformIdEnum.NanoG:
      return 'bin';
    default:
      return 'tar';
  }
};

const generateIdentification = (platformId, firmwareVersion, date) => {
  const origin = chance.pickone(possibleOrigins);
  const models = modelsForPlatformId(platformId);
  const filename =
    `${platformId}-${firmwareVersion}.${moment(date).format('YYMMDD')}.${fileExtForPlatform(platformId)}`;

  return {
    id: aguid(`${origin}~${filename}`),
    version: firmwareVersion,
    filename,
    origin,
    platformId,
    models,
  };
};

const generateSemver = (platformId) => {
  let version = '1.0.0';

  switch (platformId) {
    case FirmwarePlatformIdEnum.E50:
    case FirmwarePlatformIdEnum.E100:
    case FirmwarePlatformIdEnum.E200:
      version = chance.pickone(['1.9.2-alpha.1', '1.9.6-alpha.2', '1.9.6', '1.9.1-1', '1.9.1-1unms']);
      break;
    case FirmwarePlatformIdEnum.E600:
      version = chance.pickone(['0.2.8', '0.2.9', '1.0.0', '1.0.1']);
      break;
    case FirmwarePlatformIdEnum.E1000:
      version = '1.9.5';
      break;
    case FirmwarePlatformIdEnum.NanoG:
      version = chance.pickone(['1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.3']);
      break;
    case FirmwarePlatformIdEnum.XC:
    case FirmwarePlatformIdEnum.WA:
      version = chance.pickone(['8.3.0', '8.3.0-rc.2', '8.3.0-cs']);
      break;
    case FirmwarePlatformIdEnum.XW:
    case FirmwarePlatformIdEnum.XM:
    case FirmwarePlatformIdEnum.TI:
      version = chance.pickone(['6.6.0', '6.3.0']);
      break;
    default:
  }

  const { major, minor, patch, prerelease, order } = parseSemver(version);
  return [
    version, {
      major,
      minor,
      patch,
      prerelease,
      order,
    }];
};

const generateFirmwareImage = (origin, filename, date) => ({
  url: `${unmsGuiUrl()}/firmwares/${origin}/${filename}`,
  size: chance.natural({ min: 8e7, max: 10e7 }),
  date: Number(date),
});

const generateFirmware = () => {
  let platformId = chance.pickone(possiblePlatformIds);

  // TODO(jindrich.flidr@ubnt.com) odstranit, az bude ACB verejne
  const maskedPlatformIds = [
    FirmwarePlatformIdEnum.ACB,
    FirmwarePlatformIdEnum.E300,
    FirmwarePlatformIdEnum.XC2,
    FirmwarePlatformIdEnum.WA2,
    FirmwarePlatformIdEnum.E600,
  ];

  if (contains(platformId, maskedPlatformIds)) { platformId = FirmwarePlatformIdEnum.E50 }

  const date = chance.date({ year: 2016 });
  const [firmwareVersion, firmwareSemver] = generateSemver(platformId);
  const identification = generateIdentification(platformId, firmwareVersion, date);
  const imageInfo = generateFirmwareImage(identification.origin, identification.filename, date);

  return Object.assign({ identification, semver: firmwareSemver }, imageInfo);
};

// ensure unique filenames
const firmwares = lodash.uniqBy(times(generateFirmware, 70), toFirmwareKey);

/*
 * Route definitions
 */

function register(server) {
  server.route({
    method: 'GET',
    path: '/v2.0/firmwares',
    handler(request, reply) {
      reply(firmwares);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/firmwares',
    config: {
      payload: {
        output: 'stream',
        parse: true,
        maxBytes: 500e6,
        allow: 'multipart/form-data',
      },
    },
    handler(request, reply) {
      const newFirmware = generateFirmware();
      const key = toFirmwareKey(newFirmware);
      if (!firmwares.some(flow(toFirmwareKey, eq(key)))) {
        firmwares.push(newFirmware);
      }
      reply(newFirmware);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/firmwares/delete',
    config: {
      validate: {
        payload: validation.firmwareDeleteList,
      },
    },
    handler(request, reply) {
      // const deleteMap = keyBy(identity, request.payload);
      // const firmwaresToDelete = firmwares.filter(flow(toFirmwareKey, has(__, deleteMap)));

      // lodash.pullAll(firmwares, firmwaresToDelete);

      // reply(firmwaresToDelete);
      reply(request.payload);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.0/firmwares/ubnt',
    handler(request, reply) {
      reply(firmwares);
    },
  });
}

/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'firmwares_v2.0',
  version: '1.0.0',
};
