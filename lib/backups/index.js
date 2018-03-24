'use strict';

const { spawn, execFile } = require('child-process-promise');
const { map, curry } = require('lodash/fp');
const { pathEq } = require('ramda');
const path = require('path');
const { Reader: reader } = require('monet');
const bluebird = require('bluebird');
const fse = bluebird.promisifyAll(require('fs-extra'));
const { Form } = require('multiparty');
const { createWriteStream } = require('fs');
const targz = require('tar.gz');
const { ensureDir, remove } = require('fs-extra');
const { negate } = require('lodash/fp');
const { when, tap } = require('ramda');

const { version } = require('../../package.json');
const log = require('../logging');
const { cleanFiles, allP, resolveP, rejectP } = require('../util');
const { FirmwareOriginEnum } = require('../enums');
const { getBackupDirName } = require('./util');

const firmwareOriginsToBackup = [
  FirmwareOriginEnum.Manual,
  FirmwareOriginEnum.UBNT,
];

const lock = new Set();
const unlockApp = type => lock.delete(type);
const isAppLocked = () => lock.size !== 0;
const lockApp = (type) => {
  if (lock.has(type)) {
    throw Error(`App lock ${type} already exists`);
  }
  lock.add(type);
};

const writeBackupMetadata = (config, filePath) =>
  resolveP(() => log.info(`Backing up metadata to ${filePath}`))
    .then(() => fse.writeJsonAsync(filePath, {
      version,
      timestamp: Date.now(),
      backupFormat: config.nmsBackup.backupFormat,
    }))
    .then(() => log.info('Metadata backup successful'))
    .catch((error) => {
      log.error(`Failed to backup metadata to ${filePath}`, error);
      throw error;
    });

const readBackupMetadata = filePath => fse.readJsonAsync(filePath);

const isBackupCompatible = curry((backupFormat, metadata) => pathEq(['backupFormat'], backupFormat, metadata));

const restorePg = (pgConfig, input) => {
  log.info('Restoring Postgres...');
  const { host, port, user, database } = pgConfig;
  lockApp(input);
  const command = `psql \
    -h ${host} \
    -p ${port} \
    -U ${user} \
    -w \
    -d ${database} \
    -f ${input}/pg.sql`;

  const promise = spawn('sh', ['-c', command])
    .then(() => log.info('Postgres restore successful'))
    .catch((error) => {
      unlockApp(input);
      log.error(`Failed to restore PG from ${input}`, error);
      throw error;
    });

  const childProcess = promise.childProcess;
  childProcess.stdout.on('close', () => unlockApp(input));
  childProcess.stderr.on('data', (error) => {
    log.error(`ChildProcess stdout: Failed to restore PG from ${input}.`, error);
    return unlockApp(input);
  });

  return promise;
};


const backupPg = (pgConfig, outputDir) => {
  log.info(`Backing up postgres to ${outputDir}`);

  const { host, port, user, database, schema } = pgConfig;
  const command = `pg_dump \
    -h ${host} \
    -p ${port} \
    -U ${user} \
    -w \
    -c \
    -d ${database} \
    -n ${schema} \
    -f ${outputDir}/pg.sql`;

  const pgDumpPromise = spawn('sh', ['-c', command]);

  const childProcess = pgDumpPromise.childProcess;
  childProcess.stderr.on('data', (error) => {
    log.error(`ChildProcess stdout: Failed to backup Postgres to ${outputDir}`, error);
  });

  return pgDumpPromise
    .then(() => log.info(`Postgres backup to ${outputDir} successful`))
    .catch((error) => {
      log.error(`Failed to backup postgres to ${outputDir}.`, error);
      throw error;
    });
};


const writeRedisBackup = (host, port, input) => {
  const promise = execFile('sh', ['-c', `cat ${input}/redis | redis-cli -h ${host} -p ${port}`])
    .catch((error) => {
      log.error(`Failed to write Redis backup from ${input}.`, error);
      throw error;
    });

  const childProcess = promise.childProcess;
  childProcess.stderr.on('data', (error) => {
    log.error(`ChildProcess stdout: Failed to write Redis backup from ${input}.`, error);
  });
  return promise;
};


const restoreRedis = (host, port, input) => reader(
  ({ DB }) => resolveP(lockApp(input))
    .then(() => log.info('Restoring Redis...'))
    .then(DB.nms.flushRedis)
    .then(() => writeRedisBackup(host, port, input))
    .then(() => DB.token.list())
    .then(map(DB.token.remove))
    .then(() => unlockApp(input))
    .then(() => log.info('Redis restore successful'))
    .catch((error) => {
      log.error(`Failed to restore Redis from ${input}.`, error);
      unlockApp(input);
      throw error;
    })
);

const backupRedis = (host, port, outputDir) => {
  log.info(`Backing up redis to ${outputDir}...`);

  const redisDumpPromise = spawn('sh', ['-c', `redis-dump -h ${host} -p ${port} > ${outputDir}/redis`]);

  const childProcess = redisDumpPromise.childProcess;
  childProcess.stderr.on('data', (error) => {
    log.error(`ChildProcess stdout: Failed to backup Redis to ${outputDir}.`, error);
  });
  return redisDumpPromise
    .then(() => log.info(`Redis backup to ${outputDir} successful`))
    .catch((error) => {
      log.error(`Failed to backup Redis to ${outputDir}.`, error);
      throw error;
    });
};

const backupFirmwares = (firmwareDal, firmwaresDir, outputDir) =>
  resolveP(log.info(`Backing up firmware to ${outputDir}`))
  .then(() => allP(
    firmwareDal.findAll()
      .filter(({ identification: { origin } }) => firmwareOriginsToBackup.includes(origin))
      .map(({ identification: { origin, filename } }) =>
        fse.copyAsync(
          path.posix.join(firmwaresDir, origin, filename),
          path.posix.join(outputDir, origin, filename)
        )
    )))
  .then(() => log.info(`Firmware backup to ${outputDir} successful`))
  .catch((error) => {
    log.error(`Failed to backup firmware to ${outputDir}.`, error);
    throw error;
  });

const restoreFirmwaresByOrigin = curry((firmwareDal, sourceDir, origin) =>
  firmwareDal.removeAll(origin)
    .then(() => fse.readdirAsync(path.posix.join(sourceDir, origin)))
    .then(map(filename => firmwareDal.save(origin, fse.createReadStream(path.posix.join(sourceDir, origin, filename)))))
    .then(allP)
    .catch((err) => {
      if (err.code === 'ENOENT') return;
      throw err;
    })
);

const restoreFirmwares = (firmwareDal, sourceDir) =>
  resolveP(lockApp(sourceDir))
    .then(() => log.info('Restoring firmware...'))
    .then(() => firmwareOriginsToBackup.map(restoreFirmwaresByOrigin(firmwareDal, sourceDir)))
    .then(allP)
    .then(() => unlockApp(sourceDir))
    .then(() => log.info('Firmware restore successful'))
    .catch((error) => {
      log.error(`Failed to restore firmware from ${sourceDir}.`, error);
      unlockApp(sourceDir);
      throw error;
    });

const backupDirectory = (sourceDir, targetDir) => resolveP()
  .then(() => log.info(`Backing up directory ${sourceDir}...`))
  .then(() => fse.copyAsync(sourceDir, targetDir, { dereference: true }))
  .then(() => log.info(`Directory ${sourceDir} backup successful`))
  .catch((error) => {
    log.error(`Failed to backup directory ${sourceDir} to ${targetDir}.`, error);
    throw error;
  });

const restoreDirectory = (sourceDir, targetDir) =>
  resolveP(lockApp(targetDir))
    .then(() => log.info(`Restoring directory ${targetDir}...`))
    .then(() => fse.emptyDirAsync(targetDir))
    .then(() => fse.copyAsync(sourceDir, targetDir))
    .then(() => unlockApp(targetDir))
    .then(() => log.info(`Directory ${targetDir} restore successful`))
    .catch((error) => {
      log.error(`Failed to restore directory ${targetDir} from ${sourceDir}.`, error);
      unlockApp(targetDir);
      throw error;
    });

function cleanUnmsBackupDir(backupConfig) {
  const { dir, downloadDir } = backupConfig;
  const downloadDest = path.join(dir, downloadDir);
  return cleanFiles(backupConfig.downloadTtl, downloadDest);
}

function cleanUnmsRestoreDir(backupConfig) {
  const { dir, restoreDir } = backupConfig;
  const restoreDest = path.join(dir, restoreDir);
  return cleanFiles(backupConfig.restoreTtl, restoreDest);
}

function cleanDeviceConfigBackupMultiDir(deviceConfigBackupConfig) {
  const { dir, multiBackup } = deviceConfigBackupConfig;
  return cleanFiles(multiBackup.ttl, path.join(dir, multiBackup.dir));
}

const handleBackupUpload = (backupConfig, onSuccess) => (request, reply) => {
  const rawRequest = request.raw.req;
  let uploadPromise = null;
  const form = new Form();

  const { dir } = backupConfig;
  const uploadFile = path.join(dir, 'uploaded.tar.gz');

  form.on('error', reply);
  form.on('part', (inStream) => {
    uploadPromise = new Promise((resolve, reject) => {
      const outStream = createWriteStream(uploadFile);
      outStream.on('error', reject);
      outStream.on('close', resolve);
      inStream.pipe(outStream);
    });
  });
  form.on('close', () => reply(uploadPromise.then(() => onSuccess(uploadFile))));
  form.parse(rawRequest);
};


const backupToFile = include => reader(
  ({ config, firmwareDal }) => {
    const { dir, downloadDir } = config.nmsBackup;
    const downloadDest = path.posix.join(dir, downloadDir);

    const metadataFilePath = path.posix.join(downloadDest, 'metadata');
    const pgDownloadDir = path.posix.join(downloadDest, 'pg');
    const redisDownloadDir = path.posix.join(downloadDest, 'redis');
    const firmwaresDownloadDir = path.posix.join(downloadDest, 'firmwares');
    const siteImagesDownloadDir = path.posix.join(downloadDest, 'site-images');
    const deviceConfigsDownloadDir = path.posix.join(downloadDest, 'device-configs');

    const dirPromise = remove(downloadDest);

    const metadataPromise = dirPromise
      .then(() => ensureDir(downloadDest))
      .then(() => writeBackupMetadata(config, metadataFilePath));

    const pgPromise = dirPromise
      .then(() => ensureDir(pgDownloadDir))
      .then(() => backupPg(config.pg, pgDownloadDir));

    const redisPromise = dirPromise
      .then(() => ensureDir(redisDownloadDir))
      .then(() => backupRedis(config.redisHost, config.redisPort, redisDownloadDir));

    const firmwaresPromise = include.firmwares ?
      dirPromise
        .then(() => ensureDir(firmwaresDownloadDir))
        .then(() => backupFirmwares(firmwareDal, config.firmwares.dir, firmwaresDownloadDir)) :
      null;

    const siteImagesPromise = dirPromise
      .then(() => ensureDir(siteImagesDownloadDir))
      .then(() => backupDirectory(config.siteImages.imagesDir, siteImagesDownloadDir));

    const deviceConfigsPromise = dirPromise
      .then(() => ensureDir(deviceConfigsDownloadDir))
      .then(() => backupDirectory(config.deviceConfigBackup.dir, deviceConfigsDownloadDir));

    return Promise.all([
      metadataPromise, pgPromise, redisPromise, firmwaresPromise, siteImagesPromise, deviceConfigsPromise,
    ])
    .then(() => log.info('Backing up to disk finished, creating archive...'))
    .then(() => targz().createReadStream(downloadDest));
  }
);

const restoreFromDir = () => reader(
  ({ config, firmwareDal, messageHub, DB }) => {
    const { dir, restoreDir, downloadDir } = config.nmsBackup;
    const { settingsChanged } = messageHub.messages;
    const sourceDir = path.posix.join(dir, restoreDir, downloadDir);

    const pgBackupDir = path.posix.join(sourceDir, 'pg');
    const redisBackupDir = path.posix.join(sourceDir, 'redis');
    const firmwareBackupDir = path.posix.join(sourceDir, 'firmwares');
    const siteImagesBackupDir = path.posix.join(sourceDir, 'site-images');
    const deviceConfigsBackupDir = path.posix.join(sourceDir, 'device-configs');

    const firmwaresPromise =
      fse.stat(firmwareBackupDir)
        .then(() => restoreFirmwares(firmwareDal, firmwareBackupDir))
        .catch((err) => {
          if (err.code === 'ENOENT') return null;
          throw err;
        });

    return readBackupMetadata(path.posix.join(sourceDir, 'metadata'))
      .then(when(negate(isBackupCompatible(config.nmsBackup.backupFormat)),
        () => rejectP(new Error('Backup not compatible'))
      ))
      .then(() => Promise.all([
        restorePg(config.pg, pgBackupDir),
        restoreRedis(config.redisHost, config.redisPort, redisBackupDir).run({ DB }),
        firmwaresPromise,
        restoreDirectory(siteImagesBackupDir, config.siteImages.imagesDir),
        restoreDirectory(deviceConfigsBackupDir, config.deviceConfigBackup.dir),
      ]))
      .then(tap(() => messageHub.publish(settingsChanged())));
  }
);

const removeDeviceConfigBackupsByDeviceId = deviceId => reader(
  ({ DB }) => {
    const dirName = getBackupDirName(deviceId);
    const deleteBackupFilesPromise = fse.emptyDirAsync(dirName);
    const deleteBackupsDirPromise = deleteBackupFilesPromise.then(() => fse.rmdirAsync(dirName));

    return allP([DB.device.removeAllBackups(deviceId), deleteBackupFilesPromise, deleteBackupsDirPromise]);
  }
);


module.exports = {
  isAppLocked,
  cleanUnmsBackupDir,
  cleanUnmsRestoreDir,
  cleanDeviceConfigBackupMultiDir,
  handleBackupUpload,
  backupToFile,
  restoreFromDir,
  removeDeviceConfigBackupsByDeviceId,
};
