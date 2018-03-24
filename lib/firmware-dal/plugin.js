'use strict';

const { weave } = require('ramda-adjunct');
const { Observable } = require('rxjs/Rx');

const { registerPlugin } = require('../util/hapi');
const logging = require('../logging');
const { FirmwaresStore } = require('./store');
const storage = require('./storage');
const repository = require('./repository');
const firmwareImageParser = require('./image-parser');
const { createTempFile } = require('./utils');
const firmwaresRequest = require('./request');

function register(server) {
  const config = server.settings.app;
  const { scheduler, settings } = server.plugins;
  const firmwaresConfig = settings.firmwares;
  const { fetchUbntFirmwaresInterval } = firmwaresConfig();
  const firmwaresStore = new FirmwaresStore();

  /**
   * @name FirmwaresStorage
   * @type {{
   *    load: function():Promise.<CorrespondenceFirmware[]>,
   *    save: function(origin: string, fileStream: stream.Readable, md5: string):Promise<CorrespondenceFirmware>,
   *    remove: function(origin: string, filename: string):Promise.<void>,
   * }}
   */
  const firmwaresStorage = {
    load: weave(storage.load, { firmwaresConfig }),
    remove: weave(storage.remove, { firmwaresConfig }),
    removeAll: weave(storage.removeAll, { firmwaresConfig }),
    save: weave(storage.save, { firmwaresConfig, firmwareImageParser, createTempFile }),
  };

  /**
   * @name FirmwareDal
   * @type {{
   *   findAll: function():CorrespondenceFirmware[],
   *   findById: function(firmwareId: string):CorrespondenceFirmware,
   *   findLatestFirmware: function(string, Object?):CorrespondenceFirmware,
   *   findFirmwareDetails: function(string, version: string):DeviceFirmwareDetails,
   *   save: function(origin: string, fileStream: stream.Readable):Promise.<CorrespondenceFirmware>,
   *   remove: function(firmware: CorrespondenceFirmware):Promise.<CorrespondenceFirmware>,
   * }}
   */
  const firmwareDal = {
    findAll: weave(repository.findAll, { firmwaresStore }),
    findById: weave(repository.findById, { firmwaresStore }),
    findLatestFirmware: weave(repository.findLatestFirmware, { firmwaresStore }),
    findFirmwareDetails: weave(repository.findFirmwareDetails, { firmwaresStore }),
    save: weave(repository.save, { firmwaresStore, firmwaresStorage }),
    remove: weave(repository.remove, { firmwaresStore, firmwaresStorage }),
    removeAll: weave(repository.removeAll, { firmwaresStore, firmwaresStorage }),
    removeAllExceptLatest: weave(repository.removeAllExceptLatest, { firmwaresStore, firmwaresStorage }),
    fetchNewFirmwares: weave(
      repository.fetchNewFirmwares,
      { firmwaresStore, firmwaresConfig, firmwaresStorage, firmwaresRequest }
    ),
    countUnread: weave(repository.countUnread, { firmwaresStore }),
    downloadAndCleanUbntFirmwares: weave(
      repository.downloadAndCleanUbntFirmwares,
      { firmwaresStore, firmwaresStorage, firmwaresRequest, firmwaresConfig }
    ),
  };

  let downloadTaskInProgress = false;
  const downloadUbntFirmwaresTask = () => {
    if (downloadTaskInProgress) { return Observable.empty() }

    const { allowAutoUpdateUbntFirmwares } = firmwaresConfig();
    if (!allowAutoUpdateUbntFirmwares) { return Observable.empty() }

    downloadTaskInProgress = true;
    return firmwareDal.downloadAndCleanUbntFirmwares()
      .takeUntil(Observable.fromEvent(server, 'stop'))
      .finally(() => { downloadTaskInProgress = false })
      .catch((error) => {
        logging.error('Fetching UBNT firmware failed', error);
        return Observable.empty();
      });
  };

  if (!config.demo) {
    scheduler.registerPeriodicTask(downloadUbntFirmwaresTask, fetchUbntFirmwaresInterval, 'downloadUbntFirmwares');
  }

  server.expose(firmwareDal);

  return Observable.from(firmwaresStorage.load())
    .do(firmwares => firmwaresStore.init(firmwares))
    .do(() => downloadUbntFirmwaresTask().subscribe()) // start download as a side-effect
    .catch((error) => {
      logging.error('Firmware failed to load', error);
      return Observable.empty();
    })
    .toPromise();
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'firmwareDal',
  dependencies: ['settings', 'scheduler'],
};

