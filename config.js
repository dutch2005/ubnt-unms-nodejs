'use strict';

// load modules
const path = require('path');
const { flow, reduce } = require('lodash');
const { map, max } = require('lodash/fp');
const moment = require('moment-timezone');

const PUSH_NOTIFICATION_STAGING_URL = ''; // TODO(michael.kuk@ubnt.com)
const PUSH_NOTIFICATION_PRODUCTION_URL = ''; // TODO(michael.kuk@ubnt.com)

const { IntervalEnum, DevicePropertyEnum, LogTypeEnum, LogLevelEnum, NmsUpdateStatusEnum } = require('./lib/enums');

const toMs = (type, num) => moment.duration(num, type).asMilliseconds();

// declare internals
const internals = { Config: {} };

internals.Config.defaultNmsHostname = 'your.unmsdomain.com';
internals.Config.isTest = process.env.NODE_ENV === 'test';
internals.Config.isProduction = process.env.NODE_ENV === 'production';
internals.Config.isDevelopment = process.env.NODE_ENV === 'development';
internals.Config.demo = process.env.DEMO === 'true';
internals.Config.cloud = process.env.CLOUD === 'true';
internals.Config.hostTag = process.env.HOST_TAG;

// NOTE: if you use AWS Elastic Beanstalk, it sets many env variables like {CONTAINER_NAME}_PORT
// or {CONTAINER_NAME}_HOST which may collide with ours
internals.Config.redisHost = process.env.UNMS_REDISDB_HOST || '127.0.0.1';
internals.Config.redisPort = parseInt(process.env.UNMS_REDISDB_PORT, 10) || 6379;
internals.Config.redisDb = parseInt(process.env.UNMS_REDISDB_DB, 10) || 0;
internals.Config.fluentdHost = process.env.UNMS_FLUENTD_HOST || '127.0.0.1';
internals.Config.fluentdPort = parseInt(process.env.UNMS_FLUENTD_PORT, 10) || 24224;
internals.Config.nginxHost = process.env.UNMS_NGINX_HOST || '127.0.0.1';
internals.Config.nginxPort = parseInt(process.env.UNMS_NGINX_PORT, 10) || 12345;
internals.Config.defaultInternalHttpPort = 8081;
internals.Config.defaultInternalWsPort = 8082;
internals.Config.defaultHttpsPort = 443;
internals.Config.httpPort = parseInt(process.env.HTTP_PORT, 10) || internals.Config.defaultInternalHttpPort;
internals.Config.wsPort = parseInt(process.env.WS_PORT, 10) || internals.Config.defaultInternalWsPort;
internals.Config.publicHttpsPort = parseInt(process.env.PUBLIC_HTTPS_PORT, 10) || internals.Config.defaultHttpsPort;
internals.Config.publicWsPort = parseInt(process.env.PUBLIC_WS_PORT, 10) || internals.Config.publicHttpsPort;
internals.Config.secureLinkSecret = process.env.SECURE_LINK_SECRET || 'enigma';
internals.Config.leChallengeDir = './challenge';
internals.Config.useCustomSslCert = Boolean(process.env.SSL_CERT);
internals.Config.socketRPCTimeout = 15000; // generic rpc call timeout
internals.Config.socketRPCBackupTimeout = 180000; // backup rpc call timeout
internals.Config.pg = {
  host: process.env.UNMS_PG_HOST || '127.0.0.1',
  port: parseInt(process.env.UNMS_PG_PORT, 10) || 5432,
  database: process.env.UNMS_PG_DATABASE || 'unms',
  user: process.env.UNMS_PG_USER || 'postgres',
  password: process.env.UNMS_PG_PASSWORD || '',
  schema: process.env.UNMS_PG_SCHEMA || 'public',
};
internals.Config.rabbitMQ = {
  host: process.env.UNMS_RABBITMQ_HOST || '127.0.0.1',
  port: parseInt(process.env.UNMS_RABBITMQ_PORT, 10) || 5672,
  exchange: 'unms',
};
internals.Config.publicDir = path.join(__dirname, 'public');
internals.Config.templatePaths = map(viewPath => path.join(__dirname, viewPath), [
  '/public',
  '/lib/api-docs/templates',
]);
internals.Config.publicPaths = map(viewPath => path.join(__dirname, viewPath), [
  '/public',
  '/lib/api-docs/public',
]);

// UNMS cloud related settings
internals.Config.cloudSettings = internals.Config.cloud ? {
  domain: process.env.CLOUD_DOMAIN,
  googleMapsApiKey: process.env.CLOUD_MAPS_API_KEY,
  mapsProvider: process.env.CLOUD_MAPS_PROVIDER,
  billingApiUrl: process.env.CLOUD_BILLING_API_URL,
  ssoApiUrl: process.env.CLOUD_SSO_API_URL,
  maintenanceWindowApiUrl: process.env.CLOUD_MAINTENANCE_WINDOW_API_URL,
  redisInstanceId: process.env.UNMS_REDISDB_INSTANCE_ID,
  smtpHostname: process.env.CLOUD_SMTP_HOSTNAME,
  smtpPort: process.env.CLOUD_SMTP_PORT,
  smtpUsername: process.env.CLOUD_SMTP_USERNAME,
  smtpPassword: process.env.CLOUD_SMTP_PASSWORD,
  smtpSender: process.env.CLOUD_SMTP_SENDER_ADDRESS,
  smtpTimeout: process.env.CLOUD_SMTP_TIMEOUT,
  smtpTlsAllowUnauthorized: process.env.CLOUD_SMTP_TLS_ALLOW_UNAUTHORIZED,
  smtpSecurityMode: process.env.CLOUD_SMTP_SECURITY_MODE,
  smtpAuthEnabled: process.env.CLOUD_SMTP_AUTH_ENABLED,
  storage: {
    gcsProjectId: process.env.CLOUD_GCS_PROJECT_ID,
    gcsKeyFilename: process.env.CLOUD_GCS_KEY_FILENAME,
  },
} : null;

internals.Config.branch = process.env.BRANCH || 'master';
internals.Config.unmsLatestVersionUrl =
  `https://api.github.com/repos/Ubiquiti-App/UNMS/contents/latest-version?ref=${internals.Config.branch}`;

// discovery
internals.Config.discoveryScanTimeout = toMs('second', 5);
internals.Config.discoveryIpRangeMaxSize = 65536; // 2^16

// Reporting
internals.Config.sentryDSN =
  'https://3a0cdfa562074c6ca018c01b666d37c5:792e057ce1404e0ca8d31d2b14089eda@sentry.io/120911';
// production log token in Logentries
internals.Config.logentriesToken = 'b740d3fa-9176-43b8-b259-58a6660590dc';

// affects password hashing time, see https://github.com/kelektiv/node.bcrypt.js#a-note-on-rounds
internals.Config.pwdSaltRounds = 8;

internals.Config.jwtToken = 'x-auth-token';
internals.Config.authStrategy = 'jwt';
internals.Config.defaultEmail = 'unms@ubnt.com';
internals.Config.defaultUsername = 'ubnt';
internals.Config.defaultPwd = 'ubntubnt';
internals.Config.passwordTokenExpiry = toMs('minute', 30);
internals.Config.sessionTimeout = toMs('minute', 30);
internals.Config.extendedSessionTimeout = toMs('hour', 24);

internals.Config.hashAlgorithm = 'aes-256-cbc';
internals.Config.totpAuthSecretOptions = {
  issuer: 'UNMS',
};

internals.Config.httpConnection = {
  port: internals.Config.httpPort,
  routes: {
    cors: {
      origin: ['*'],
      headers: ['Accept', 'Authorization', 'Content-Type', 'If-None-Match', internals.Config.jwtToken],
      exposedHeaders: [internals.Config.jwtToken],
    },
    files: {
      relativeTo: internals.Config.publicDir,
    },
    security: true,
  },
  state: {
    strictHeader: false,
  },
};

internals.Config.deviceConfigBackup = {
  dir: './data/config-backups',
  minimumFiles: 6,
  ttl: toMs('day', 30),
  multiBackup: {
    dir: 'multi',
    ttl: toMs('hour', 1),
  },
  fileMaxBytes: 10000000,
  queue: {
    delay: toMs('minute', 2),
    concurency: 5,
  },
};

internals.Config.deviceTypes = {
  all: ['olt', 'erouter'],
};

internals.Config.deviceServices = {
  ntpServers: {
    ntpServer1: '0.pool.ntp.org',
    ntpServer2: '1.pool.ntp.org',
  },
};

internals.Config.statisticsIntervals = {
  minute: { length: toMs('minute', 2), period: toMs('second', 1) },
  hour: { length: toMs('hour', 1), period: toMs('second', 15) },
  day: { length: toMs('day', 1), period: toMs('minute', 15) },
  month: { length: toMs('month', 1), period: toMs('hour', 8) },
  quarter: { length: toMs('month', 3), period: toMs('hour', 24) },
  year: { length: toMs('year', 1), period: toMs('hour', 106) },
};

internals.Config.statisticsIntervalMapping = {
  [IntervalEnum.Hour]: ['hour'],
  [IntervalEnum.Day]: ['day'],
  [IntervalEnum.Month]: ['month'],
  [IntervalEnum.Quarter]: ['quarter'],
  [IntervalEnum.Year]: ['year'],
};

const findMaxStatisticsIntervalPeriod = flow(
  map(name => internals.Config.statisticsIntervals[name].period),
  max
);
internals.Config.statisticsIntervalPeriodMapping = reduce(
  internals.Config.statisticsIntervalMapping,
  (acc, values, interval) => (Object.assign(acc, { [interval]: findMaxStatisticsIntervalPeriod(values) })),
  {}
);

const findMaxStatisticsIntervalLength = flow(
  map(name => internals.Config.statisticsIntervals[name].length),
  max
);
internals.Config.statisticsIntervalLengthMapping = reduce(
  internals.Config.statisticsIntervalMapping,
  (acc, values, interval) => (Object.assign(acc, { [interval]: findMaxStatisticsIntervalLength(values) })),
  {}
);

internals.Config.deviceLog = {
  [DevicePropertyEnum.Cpu]: {
    name: 'CPU',
    unit: '%',
    limit: 90,
    interval: toMs('second', 30),
    level: LogLevelEnum.Warning,
    logType: LogTypeEnum.DeviceCpuOverLimit,
  },
  [DevicePropertyEnum.Ram]: {
    name: 'RAM',
    unit: '%',
    limit: 90,
    interval: toMs('second', 10),
    level: LogLevelEnum.Warning,
    logType: LogTypeEnum.DeviceRamOverLimit,
  },
};

internals.Config.outages = {
  unmsStartGracePeriod: toMs('minute', 2),
  lagGracePeriod: toMs('second', 5), // avoid responding to possible lagging device's communication
  maxAge: toMs('month', 3),
};

internals.Config.siteImages = {
  publicDir: './public',
  imagesUrl: 'site-images',
  imagesDir: './public/site-images', // images directory is mapped to /data/images in docker
  maxBytes: 20000000, // 20MB
  maxResolution: 10000 ** 2, // limit in pixels
  thumb: {
    width: 700, // px
    height: 700, // px
  },
};

internals.Config.nmsBackup = {
  dir: './data/unms-backups',
  restoreDir: 'restore',
  downloadDir: 'download',
  downloadTtl: toMs('hour', 1),
  restoreTtl: toMs('hour', 1),
  fileMaxBytes: 1000000000, // 1GB
  backupFormat: '1',
};

internals.Config.logs = {
  dir: './data/logs',
  ttl: toMs('day', 5),
  downloadDir: 'supportinfo',
  downloadTtl: toMs('hour', 1),
  packageName: 'logs.tgz',
};

internals.Config.import = {
  dir: './data/import',
};

internals.Config.firmwares = {
  dir: path.join(__dirname, 'public', 'firmwares'), // firmwares directory is mapped to /data/firmwares in docker
  publicDir: 'firmwares',
  urlExpiration: toMs('hour', 1),
  allowAutoUpdateUbntFirmwares: true,
  fetchUbntFirmwaresConcurrency: 1,
  fetchUbntFirmwaresInterval: toMs('hour', 1),
};

internals.Config.interfaces = {
  mtuDefault: 1500,
  mtuMin: 68,
  mtuMax: 2018,
  pppoeMtuDefault: 1492,
  pppoeMtuMin: 68,
  pppoeMtuMax: 1500,
};

internals.Config.periodSelectOptions = {
  defaults: {
    log: toMs('hour', 1),
    outage: toMs('hour', 1),
  },
};

internals.Config.eventLog = {
  mailNotification: {
    level: [LogLevelEnum.Error],
    type: [LogTypeEnum.DeviceReappear],
    maxItems: 100,
    failedLogPeriod: toMs('day', 1),
  },
  maxAge: toMs('day', 30),
};

internals.Config.nmsUpdate = {
  dir: './data/update',
  requestFile: './data/update/request-update',
  daemonActiveLimit: toMs('minute', 3),
  lastUpdateFile: './data/update/last-update',
  logFile: './data/update/update.log',
  timeouts: {
    [NmsUpdateStatusEnum.Requested]: toMs('minute', 2),
    [NmsUpdateStatusEnum.Started]: toMs('minute', 1),
    [NmsUpdateStatusEnum.Updating]: toMs('minute', 15),
  },
  backupFile: `${internals.Config.nmsBackup.dir}/update-backup.tar.gz`,
};

internals.Config.fixtures = {
  site: {
    count: 30,
  },
  endpoint: {
    minCount: 1,
    maxCount: 5,
  },
  device: {
    count: 100,
  },
};

internals.Config.pushNotificationServiceUrl =
  process.env.PUSH_NOTIFICATION_URL ||
  (internals.Config.isProduction ? PUSH_NOTIFICATION_PRODUCTION_URL : PUSH_NOTIFICATION_STAGING_URL);

// push notifications currently on self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

internals.Config.connectionLogEventInterval = toMs('day', 1);

internals.Config.apiRateLimit = {
  userCacheExpiresIn: toMs('minute', 2),
};

internals.Config.newsFeedUrl =
  internals.Config.isProduction ?
  'https://unms.com/assets/notifications/news.json' :
  'https://dev-unms-micro.ubnt.com/assets/notifications/news.json';

module.exports = internals.Config;
