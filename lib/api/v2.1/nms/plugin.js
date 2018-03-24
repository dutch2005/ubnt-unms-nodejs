'use strict';

const fs = require('fs');
const Joi = require('joi');
const { pick, get, noop, values, tap } = require('lodash/fp');
const { curry, constant, spread, head } = require('lodash');
const { assoc, apply, curryN, assocPath, pipe } = require('ramda');
const boom = require('boom');
const bluebird = require('bluebird');
const { ensureDirAsync, removeAsync } = bluebird.promisifyAll(require('fs-extra'));
const targz = require('tar.gz');
const path = require('path');
const moment = require('moment-timezone');

const { registerPlugin } = require('../../../util/hapi');
const config = require('../../../../config');
const Validation = require('../../../validation');
const { generatePasswordHashF } = require('../../../auth');
const { getUnmsHostname, toMs } = require('../../../util');
const { testSmtpAuthSettings, handleSmtpError } = require('../../../util/smtp');
const enums = require('../../../enums');
const { handleBackupUpload } = require('../../../backups');
const { log, packLogs } = require('../../../logging');
const { connectionString } = require('../../../settings');
const { version } = require('../../../../package.json');
const service = require('./service');
const { updateNmsWithHostname } = require('../setup/service.js');
const { fromApiUser, toDbUserProfile } = require('../../../transformers/user');
const { FlutureTMonetEither: FutureTEither } = require('monad-t');

/*
 * Business logic
 */

const nmsToTestEmailContext = nms => ({ unmsHostname: getUnmsHostname(nms) });

const isNmsConfiguredCheck = (nms) => {
  if (nms.isConfigured) {
    throw boom.forbidden('NMS has already been configured');
  }
  return nms;
};

const updateNmsWithSmtp = curry((smtp, nms) => Object.assign({}, nms, { smtp }));

const updateNmsWithTimezone = curry((timezone, nms) => assoc('timezone', timezone, nms));

const updateNmsEula = (eulaConfirmed, email) => pipe(
  assocPath(['eula', 'timestamp'], eulaConfirmed ? moment().valueOf() : null),
  assocPath(['eula', 'email'], email)
);

const pickSupportInfo = pick([
  'hostname',
  'instanceId',
  'devicePingAddress',
  'allowLoggingToSentry',
  'allowLoggingToLogentries',
]);

const flagNmsAsConfigured = nms => Object.assign({}, nms, { isConfigured: true });

const createUser = apiUser => FutureTEither
  .fromEither(fromApiUser({}, apiUser))
  .chain(cmUser => FutureTEither
    .both(
      FutureTEither.fromFuture(generatePasswordHashF(apiUser.password)),
      FutureTEither.fromValue(cmUser)
    )
    .map(apply(assoc('password')))
  );

const createUserProfile = curryN(2, (dal, cmUser) => FutureTEither
  .fromEither(toDbUserProfile(cmUser))
  .chain(FutureTEither.encaseP(dal.userProfileRepository.upsert)));

/*
 * Route definitions
 */

function register(server) {
  server.route({
    method: 'GET',
    config: {
      auth: false,
    },
    path: '/v2.1/nms/heartbeat',
    handler(request, reply) {
      reply({ result: true, message: "I'm alive" });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/nms/connection',
    config: {
      auth: {
        scope: 'admin',
      },
    },
    handler(request, reply) {
      reply(connectionString());
    },
  });

  server.route({
    path: '/v2.1/nms/setup',
    method: 'POST',
    config: {
      auth: false,
      validate: {
        payload: {
          hostname: Validation.hostname,
          useLetsEncrypt: Joi.boolean(),
          eulaConfirmed: Joi.boolean(),
          user: Joi.object().keys({
            username: Validation.username,
            email: Joi.string().email().required(),
            timezone: Validation.timezone.required(),
            password: Validation.password,
          }).with('username', 'email', 'password', 'timezone'),
          smtp: Validation.smtp,
        },
      },
    },
    handler(request, reply) {
      const { messageHub, DB, dal, nginx, settings } = server.plugins;
      const { settingsChanged } = messageHub.messages;
      const { smtp, hostname, user, useLetsEncrypt, eulaConfirmed } = request.payload;

      const nmsPromise = DB.nms.get()
        .then(isNmsConfiguredCheck);

      const smtpCheckPromise = nmsPromise
        .then(() => testSmtpAuthSettings(smtp));

      reply(
        Promise.all([nmsPromise, smtpCheckPromise])
          .then(head)
          .then(updateNmsWithSmtp(smtp))
          .then(updateNmsWithHostname(hostname))
          .then(updateNmsWithTimezone(user.timezone))
          .then(updateNmsEula(eulaConfirmed, user.email))
          .then(flagNmsAsConfigured)
          .then(DB.nms.update)
          .then(
            () => createUser(user)
              .tapF(FutureTEither.encaseP(dal.userRepository.create))
              .tapF(createUserProfile(dal))
              .promise()
          )
          .then(tap(() => messageHub.publish(settingsChanged())))
          .then(() => nginx.updateSslCertificate(useLetsEncrypt))
          .then(settings.loadSettings)
          .then(() => ({
            connectionString: settings.connectionString(),
            isLetsEncryptError: settings.isLetsEncryptError(),
          }))
      );
    },
  });

  server.route({
    path: '/v2.1/nms/settings',
    method: 'GET',
    handler(request, reply) {
      const { settings } = server.plugins;
      reply(
        service.getNmsSettings().run({ settings })
      );
    },
  });

  server.route({
    path: '/v2.1/nms/settings',
    method: 'PUT',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: Joi.object().keys({
          timezone: Validation.timezone,
          hostname: Validation.hostname,
          autoBackups: Joi.boolean().required(),
          mapsProvider: Joi.string().valid(...values(enums.MapsProviderEnum)).required(),
          googleMapsApiKey: Joi.string().allow(null),
          devicePingAddress: Validation.devicePingAddress,
          devicePingIntervalNormal: Validation.devicePingIntervalNormal,
          devicePingIntervalOutage: Validation.devicePingIntervalOutage,
          useLetsEncrypt: Joi.boolean(),
          allowLoggingToSentry: Joi.boolean(),
          allowLoggingToLogentries: Joi.boolean(),
          deviceTransmissionProfile: Validation.DeviceTransmissionProfile,
          defaultGracePeriod: Joi.number().integer().min(30000).max(300000).required(),
          restartGracePeriod: Joi.number().integer().min(30000).max(300000).required(),
          upgradeGracePeriod: Joi.number().integer().min(30000).max(300000).required(),
          dateFormat: Joi.string().valid(enums.DateFormatEnum).required(),
          timeFormat: Joi.string().valid(enums.TimeFormatEnum).required(),
          allowAutoUpdateUbntFirmwares: Joi.boolean().required(),
        }),
      },
    },
    handler(request, reply) {
      const { messageHub, DB, settings, nginx } = server.plugins;

      reply(
        service.updateNmsSettings(request.payload).run({
          messageHub, DB, settings, nginx,
        })
      );
    },
  });

  server.route({
    path: '/v2.1/nms/update',
    method: 'PUT',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: Joi.object().keys({
          version: Joi.string().required(),
        }),
      },
    },
    handler(request, reply) {
      reply(
        Promise.resolve(request.payload.version)
          .then(server.plugins.update.requestNmsUpdate)
          .then(constant({ result: true, message: 'Update process initiated.' }))
      );
    },
  });

  server.route({
    path: '/v2.1/nms/update',
    method: 'GET',
    handler(request, reply) {
      reply(server.plugins.update.getNmsUpdateStatus());
    },
  });

  server.route({
    path: '/v2.1/nms/refresh-certificate',
    method: 'PUT',
    config: {
      auth: {
        scope: 'admin',
      },
    },
    handler(request, reply) {
      const { nginx } = server.plugins;
      reply(
        nginx.updateSslCertificate(null)
          .then(constant({ result: true, message: 'Certificate refreshed.' }))
      );
    },
  });

  server.route({
    path: '/v2.1/nms/version',
    method: 'GET',
    config: {
      auth: false,
    },
    handler(request, reply) {
      reply({ version });
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/nms/maintenance/backup',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        query: {
          retention: Joi.any().valid('7', '30', '60', '90', '180', '365', '-1').required(),
        },
      },
    },
    handler(request, reply) {
      // TODO (karel.kristal@ubnt.com): employ retention parameter
      reply(server.plugins.backups.backupToFile({ firmwares: false })).type('application/tar+gzip');
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/nms/maintenance/backup',
    config: {
      auth: {
        scope: 'admin',
      },
      timeout: {
        socket: false,
      },
      ext: {
        onPostAuth: {
          method: handleBackupUpload(config.nmsBackup, (uploadedFile) => {
            const { dir, restoreDir } = config.nmsBackup;
            const uploadFileDest = path.join(dir, restoreDir);
            return removeAsync(uploadFileDest)
              .then(() => ensureDirAsync(config.nmsBackup.dir))
              .then(() => targz().extract(uploadedFile, uploadFileDest))
              .then(constant({ result: true, message: 'Backup file saved.' }));
          }),
        },
      },
      payload: {
        timeout: false,
        output: 'stream',
        parse: false,
        allow: 'multipart/form-data',
        maxBytes: config.nmsBackup.fileMaxBytes,
      },
    },
    handler: noop,
  });

  server.route({
    method: 'GET',
    config: {
      auth: {
        scope: 'admin',
      },
    },
    path: '/v2.1/nms/maintenance/backup/restore',
    handler(request, reply) {
      const { backups, logging } = server.plugins;

      setTimeout(() => server.root.stop()
        .then(backups.restoreFromDir)
        .then(() => process.exit(0))
        .catch(error => logging.error('Restore UNMS has failed.', error)),
      toMs('seconds', 2));

      reply({ result: true, message: 'Backup restore began. UNMS will restart after it\'s finished.' });
    },
  });

  server.route({
    method: 'GET',
    config: {
      auth: {
        scope: 'admin',
      },
    },
    path: '/v2.1/nms/maintenance/supportinfo',
    handler(request, reply) {
      const { DB } = server.plugins;
      const { downloadDir } = config.logs;
      const logsDownloadDir = path.join(downloadDir, 'logs');
      const logsPackagePath = path.join(logsDownloadDir, config.logs.packageName);

      reply(
        DB.nms.get()
          .then(pickSupportInfo)
          .then(JSON.stringify)
          .then(supportInfo => log('info', supportInfo))
          .then(() => removeAsync(logsDownloadDir))
          .then(() => ensureDirAsync(logsDownloadDir))
          .then(() => packLogs(logsDownloadDir))
          .then(() => fs.createReadStream(logsPackagePath))
      ).type('application/tar+gzip');
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/nms/mailserver',
    config: {
      auth: {
        scope: 'admin',
      },
    },
    handler(request, reply) {
      const { DB } = server.plugins;

      reply(
        DB.nms.get().then(get('smtp'))
      );
    },
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/nms/mailserver',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: Validation.smtp,
      },
    },
    handler(request, reply) {
      const { DB } = server.plugins;

      reply(
        service.updateSmtp(request.payload).run({ DB })
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/nms/mailserver/test',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: {
          to: Joi.string().email().required(),
          smtp: Validation.smtp,
        },
      },
    },
    handler(request, reply) {
      const { DB, mail } = server.plugins;
      const contextPromise = DB.nms.get().then(nmsToTestEmailContext);
      const mailData = { to: request.payload.to };
      const sender = mail.configureAndSendTest(request.payload.smtp);

      reply(
        Promise
          .all([mailData, contextPromise])
          .then(spread(sender))
          .then(constant({ result: true, message: 'Testing email sent.' }))
          .catch(handleSmtpError(request.payload.smtp))
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/nms/summary',
    config: {
      validate: {
        query: {
          outagesTimestamp: Joi.date().timestamp('javascript').raw(),
          logsTimestamp: Joi.date().timestamp('javascript').raw(),
          logsLevel: Joi.array().items(
            Joi.string().valid(...values(enums.LogLevelEnum))
          ).required(),
          firmwaresTimestamp: Joi.date().timestamp('javascript').raw(),
        },
      },
    },
    handler(request, reply) {
      const {
        DB,
        deviceStore,
        'apiLogsV2.1': apiLogs,
        'devicesV2.1': apiDevices,
        'apiOutagesV2.1': apiOutages,
        'apiFirmwaresV2.1': apiFirmwares,
      } = server.plugins;
      const { outagesTimestamp, logsTimestamp, logsLevel, firmwaresTimestamp } = request.query;

      reply(
        service.getSummary({ outagesTimestamp, logsTimestamp, logsLevel, firmwaresTimestamp })
          .run({ DB, deviceStore, apiLogs, apiDevices, apiOutages, apiFirmwares })
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/v2.1/nms/news',
    config: {
      description: 'Get news from UNMS feed for user',
      tags: ['api', 'nms'],
    },
    handler(request, reply) {
      const { user: userService, dal } = server.plugins;

      reply(service.getNews(request.token.userId).run({ userService, dal }));
    },
  });
}


/*
 * Hapijs Plugin definition
 */
exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'nms_v2.1',
  version: '1.0.0',
  dependencies: ['auth', 'messageHub', 'DB', 'settings', 'mail', 'dal'],
};
