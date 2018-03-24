'use strict';

const { Reader: reader } = require('monet');
const aguid = require('aguid');
const { when, assoc, always, pathEq, tap, pick, path } = require('ramda');
const { isNotNull, weave, cata, isNotUndefined } = require('ramda-adjunct');
const { forEach, get, getOr, map, values, curry, isNull, filter, keyBy } = require('lodash/fp');

const { OutageTypeEnum, LogTypeEnum, ProgressStatusEnum } = require('../enums');
const { resolveP, rejectP, allP } = require('../util');
const { mergeRight } = require('../transformers');
const { fromDbList, fromDb } = require('../transformers/device');
const { mergeMetadataList } = require('../transformers/device/mergers');
const { fromDbList: fromDbDeviceMetadataList } = require('../transformers/device/metadata');

const isOutageLogged = getOr(false, ['isLogged']);
const isDeviceUpgrading = pathEq(['upgrade', 'status'], ProgressStatusEnum.InProgress);
const isOverGracePeriod = curry((now, lagGracePeriod, outageWithGracePeriod) => {
  const { outage, gracePeriod } = outageWithGracePeriod;
  const isIgnored = now - outage.startTimestamp < lagGracePeriod; // too early upon outage has started
  const isOver = now - outage.startTimestamp > gracePeriod;
  return !isIgnored && isOver;
});
const isServerStarting = (store, unmsStartGracePeriod, now) =>
  store.get(['serverMeta', 'startTimestamp']) + unmsStartGracePeriod > now;

const getOutages = () => reader(
  ({ store }) => values(store.get('outages', {}))
);

const getOutage = deviceId => reader(
  ({ store }) => store.get(['outages', deviceId])
);

const setOutage = (deviceId, outage) => reader(
  ({ store }) => store.set(['outages', deviceId], outage)
);

const deleteOutage = deviceId => reader(
  ({ store }) => store.unset(['outages', deviceId])
);

const logOutage = outageLogEntry => reader(
  ({ store }) => store.push('outageLog', outageLogEntry)
);

const logDeviceReappear = deviceId => reader(
  ({ DB, logDeviceInfoEvent }) => DB.device.findById(deviceId)
    .catch(always(null))
    .then(when(isNotNull, logDeviceInfoEvent(LogTypeEnum.DeviceReappear)))
);

const getOutagesGracePeriods = curry((outages, devices) => reader(
  ({ settings, dal, store }) => {
    const {
      defaultGracePeriod,
      upgradeGracePeriod,
      restartGracePeriod,
      unmsStartGracePeriod,
    } = settings.getOutageSettings();
    const isUnmsStarting = isServerStarting(store, unmsStartGracePeriod, Date.now());
    const deviceMap = keyBy(get(['identification', 'id']), devices);
    return dal.deviceMetadataRepository.findRestarting()
      .then((restartingDevices) => {
        const restartingDevicesSet = new Set(restartingDevices.map(get('id')));
        return outages.map((outage) => {
          const deviceId = outage.device.identification.id;
          const device = deviceMap[deviceId];
          const isDeviceRestarting = restartingDevicesSet.has(deviceId);

          let gracePeriod = defaultGracePeriod;

          if (isDeviceRestarting) { gracePeriod = restartGracePeriod }
          if (isDeviceUpgrading(device)) { gracePeriod = upgradeGracePeriod }
          if (isUnmsStarting) { gracePeriod = unmsStartGracePeriod }

          return { outage, gracePeriod };
        });
      });
  }));

const logOutageItem = curry((now, outageWithGracePeriod) => reader(
  ({ store }) => {
    const { gracePeriod, outage } = outageWithGracePeriod;

    if (isOutageLogged(outage)) { return }

    const logEntry = {
      gracePeriod,
      deviceIdentification: path(['identification'], outage.device),
      deviceMetadata: path(['meta'], outage.device),
      time: now,
    };

    logOutage(logEntry).run({ store });
    setOutage(outage.device.identification.id, assoc('isLogged', true, outage)).run({ store });
  }
));

const createOutageItem = curry((now, outageWithGracePeriod) => reader(
  ({ dal }) => {
    const { outage: { id, startTimestamp, device } } = outageWithGracePeriod;
    const dbEntry = {
      id,
      startTimestamp,
      endTimestamp: now,
      type: OutageTypeEnum.Outage,
    };
    if (isNotUndefined(device)) {
      dbEntry.device = device.identification;
    }
    if (get(['identification', 'site'], device)) {
      dbEntry.site = device.identification.site;
    }
    if (get(['identification', 'siteId'], device)) {
      dbEntry.site = Object.assign({}, dbEntry.site, { id: device.identification.siteId });
    }

    return dal.outageModel.build(dbEntry).get();
  }
));

const saveOutagesToDb = outages => reader(
  ({ dal, logging }) => dal.outageRepository.bulkSave(outages)
    .catch(error => logging.error({ message: 'Failed to save outages to DB.' }, error))
);

const saveOutages = (now = Date.now()) => reader(
  ({ store, dal, settings, logging, DB }) => {
    const { lagGracePeriod } = settings.getOutageSettings();
    const outages = getOutages().run({ store });

    return allP([DB.device.list(), dal.deviceMetadataRepository.findAll()])
      .then(([devices, dbDeviceMetadataList]) =>
        fromDbList({}, devices)
          .chain(mergeRight(mergeMetadataList, fromDbDeviceMetadataList({}, dbDeviceMetadataList)))
          .cata(rejectP, resolveP))
      .then(weave(getOutagesGracePeriods(outages), { settings, dal, store }))
      .then(filter(isOverGracePeriod(now, lagGracePeriod)))
      .then(tap(forEach(weave(logOutageItem(now), { store }))))
      .then(map(weave(createOutageItem(now), { dal })))
      .then(weave(saveOutagesToDb, { dal, logging }));
  }
);

const deviceDisconnected = curry((now, cmDevice) => reader(
  ({ store }) => {
    const outage = getOutage(cmDevice.identification.id).run({ store });
    const isOutageOlder = isNotNull(outage) && outage.startTimestamp < now;

    if (isOutageOlder) { return null }

    return setOutage(cmDevice.identification.id, {
      id: aguid(),
      device: pick(['identification', 'meta'], cmDevice),
      startTimestamp: now,
    }).run({ store });
  }
));

const stopOutage = (now, deviceId) => reader(
  ({ DB, store, logging, dal, settings, eventLog: { logDeviceInfoEvent }, messageHub }) => {
    const { deviceOutageStopped } = messageHub.messages;
    return saveOutages(now)
      .run({ store, dal, settings, logging, DB })
      .then(() => getOutage(deviceId).run({ store }))
      .then(when(isOutageLogged, () => logDeviceReappear(deviceId).run({ DB, logDeviceInfoEvent })))
      .then(() => deleteOutage(deviceId).run({ store }))
      .then(() => DB.device.findById(deviceId))
      .then(fromDb({}))
      .then(cata(rejectP, resolveP))
      .then(cmDevice => messageHub.publish(deviceOutageStopped(cmDevice)))
      .catch(error => logging.error({ message: 'Failed to log device reappear event.', deviceId }, error, now));
  }
);

const stopOutageOnDeviceRemoved = (now, deviceId) => reader(
  ({ DB, store, logging, dal, settings }) => saveOutages(now)
    .run({ store, dal, settings, logging, DB })
    .then(() => deleteOutage(deviceId).run({ store }))
    .catch(error => logging.error({ message: 'Failed delete outage on device remove.', deviceId }, error, now))
);

const deviceConnected = (now, deviceId) => reader(
  ({ DB, store, logging, dal, settings, eventLog, messageHub }) => {
    const outage = getOutage(deviceId).run({ store });

    if (isNull(outage) || outage.startTimestamp > now) { return resolveP() }

    return stopOutage(now, deviceId)
      .run({ DB, store, logging, dal, settings, messageHub, eventLog });
  }
);

const cleanOldOutages = (now = Date.now()) => reader(
  ({ dal, logging, settings }) => {
    const maxEndTimestamp = now - settings.getOutageSettings().maxAge;

    return dal.outageRepository.removeOld(maxEndTimestamp)
      .catch(err => logging.error('Failed to delete old outages', err, now));
  }
);

const initOutages = (now = Date.now()) => reader(
  ({ DB, store, dal }) =>
    allP([DB.device.list(), dal.deviceMetadataRepository.findAll()])
      .then(([devices, dbDeviceMetadataList]) =>
        fromDbList({}, devices)
          .chain(mergeRight(mergeMetadataList, fromDbDeviceMetadataList({}, dbDeviceMetadataList)))
          .cata(rejectP, resolveP))
    .then(forEach(weave(deviceDisconnected(now), { store })))
);

module.exports = {
  saveOutages,
  stopOutage,
  stopOutageOnDeviceRemoved,
  deviceDisconnected,
  deviceConnected,
  cleanOldOutages,
  getOutages,
  initOutages,
};
