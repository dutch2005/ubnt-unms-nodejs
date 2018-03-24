'use strict';

const { Reader: reader } = require('monet');
const { path, countBy, curry, zipObj, clone, assoc } = require('ramda');
const { get, getOr, isUndefined, isNull, spread, size } = require('lodash/fp');
const { Observable } = require('rxjs/Rx');
const os = require('os');

const { log } = require('../logging');
const { StatusEnum } = require('../enums');
const { toMs } = require('../util');

require('../util/observable');


const countTypes = countBy(path(['identification', 'type']));
const countOutages = countBy(path(['dataValues', 'device', 'id']));
const logStats = curry((tags, stats) => log(tags, stats));

const createNewModel = type => ({
  type,
  all: { count: 0, outages: 0, fw: {} },
  active: { count: 0, outages: 0, fw: {} },
});

const ensureModelAndReturnNewAcc = (model, type, acc) => {
  if (isUndefined(acc[model])) {
    return assoc(model, createNewModel(type), acc);
  }
  return clone(acc);
};

const addFirmwareVersion = (firmwares, device) => {
  const firmwareVersion = get(['identification', 'firmwareVersion'], device);
  if (isUndefined(firmwares[firmwareVersion])) {
    return assoc(firmwareVersion, 1, firmwares);
  }
  return assoc(firmwareVersion, firmwares[firmwareVersion] + 1, firmwares);
};

const generateModels = (outagesCounts, devices) => Observable.from(devices)
  .reduce((acc, device) => {
    const deviceId = get(['identification', 'id'], device);
    const model = get(['identification', 'model'], device);
    const type = get(['identification', 'type'], device);
    const newAcc = ensureModelAndReturnNewAcc(model, type, acc);
    const outagesCount = getOr(0, [deviceId], outagesCounts);

    newAcc[model].all.count += 1;
    newAcc[model].all.outages += outagesCount;
    newAcc[model].all.fw = addFirmwareVersion(newAcc[model].all.fw, device);

    if (device.overview.status === StatusEnum.Active) {
      newAcc[model].active.count += 1;
      newAcc[model].active.outages += outagesCount;
      newAcc[model].active.fw = addFirmwareVersion(newAcc[model].active.fw, device);
    }

    return newAcc;
  }, {});

const getUnmsData = () => reader(
  ({ DB }) => Observable.from(DB.nms.get())
    .map(unms => ({
      updateFrequency: unms.deviceTransmissionProfile,
      mapsProvider: get(['maps', 'provider'], unms),
      timezone: unms.timezone,
    }))
);

const getServerData = () => reader(
  ({ store }) => {
    if (isNull(store.get(['serverMeta', 'platform']))) { store.set(['serverMeta', 'platform'], os.platform()) }
    if (isNull(store.get(['serverMeta', 'cpuArch']))) { store.set(['serverMeta', 'cpuArch'], os.arch()) }
    if (isNull(store.get(['serverMeta', 'cpus']))) { store.set(['serverMeta', 'cpus'], size(os.cpus())) }

    return Observable.of({
      platform: store.get(['serverMeta', 'platform']),
      cpu: store.get(['serverMeta', 'cpuArch']),
      cpus: store.get(['serverMeta', 'cpus']),
    });
  }
);

const logUnmsStatistics = () => reader(
  ({ user, DB, store, dal, logging }) => {
    const users$ = Observable.fromPromise(user.countUsers().promise());
    const sites$ = Observable.from(DB.site.list()).map(countTypes);
    const unms$ = getUnmsData().run({ DB });
    const devices$ = Observable.from(DB.device.list());
    const devicesCounts$ = devices$.map(countTypes);
    const outagesCount$ = Observable.from(dal.outageRepository.findAllByRequestParams({ period: toMs('week', 1) }))
      .map(countOutages);
    const models$ = Observable.forkJoin(outagesCount$, devices$)
      .mergeMap(spread(generateModels));
    const server$ = getServerData().run({ store });

    return Observable
      .zip(users$, sites$, devicesCounts$, models$, unms$, server$)
      .map(zipObj(['users', 'sites', 'devices', 'models', 'unms', 'server']))
      .subscribe({
        next: stats => logStats(['info', 'statistics'], stats),
        error: error => logging.error('Unms stats failed', error),
      });
  }
);

module.exports = {
  logUnmsStatistics,
};
