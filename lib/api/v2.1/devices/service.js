'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const boom = require('boom');
const { ifElse, chain, pathEq, filter, map, when, pick, assocPath, reject, pathSatisfies } = require('ramda');
const { cata, isNotNull } = require('ramda-adjunct');
const { Either } = require('monet');
const {
  get, eq, tap, constant, head, stubArray, flatten, size, find, isUndefined, isNull, keyBy, has, __,
} = require('lodash/fp');
const { Future } = require('fluture');
const FutureTEither = require('monad-t/lib/FlutureTMonetEither');

const { EntityEnum, LogTypeEnum, DeviceTypeEnum, TaskTypeEnum, StatusEnum } = require('../../../enums');
const { entityExistsCheck, allP, rejectP, resolveP, tapP } = require('../../../util');
const { compareSemver } = require('../../../util/semver');
const { hasCustomScriptsSupport } = require('../../../feature-detection/firmware');
const {
  fromDbList: fromDbDeviceList, toApiDeviceStatusOverviewList, fromDb: fromDbDevice, toDb: toDbDevice,
  toApiDeviceStatusOverview,
} = require('../../../transformers/device');
const { toApiSystem, fromApiSystem, fromApiServices, toApiServices } = require('../../../transformers/device/erouter');
const { fromDbUser } = require('../../../transformers/user');
const {
  toApiMacAddressList, fromDbDeviceList: macAddressListFromDbDeviceList,
} = require('../../../transformers/device/mac-address');
const {
  fromDbDevice: fromDbDeviceUnmsSettings, fromApiUnmsSettings, toApiUnmsSettings, mergeDbDeviceUnmsSettings,
} = require('../../../transformers/device/unms-settings');
const { fromDbList: fromDbInterfaceList, toDbInterfaceList } = require('../../../transformers/interfaces');
const { fromDb: fromDbSite } = require('../../../transformers/site');
const { replaceInterfaceInList } = require('../../../transformers/interfaces/mergers');
const { resetInterfaceStatistics: resetInterfaceStatisticsAp } = require('../../../transformers/interfaces/ap');
const {
  mergeInterfaces, mergeMetadataList, mergeMetadata, mergeSite,
} = require('../../../transformers/device/mergers');
const {
  fromDbList: fromDbDeviceMetadataList, toDb: toDbDeviceMetadata, fromDb: fromDbDeviceMetadata,
} = require('../../../transformers/device/metadata');
const { mergeRight, merge } = require('../../../transformers');
const { toApiUser } = require('../../../transformers/user');
const { castMacAesKeyToDevice } = require('../../../transformers/mac-aes-key');


const filterUnknownDevices = (devices, unknownDevices) => {
  const deviceIdsMap = keyBy(get(['identification', 'id']), devices);
  return reject(pathSatisfies(has(__, deviceIdsMap), ['identification', 'id']), unknownDevices);
};

/**
 * @param {?string} [siteId]
 * @return {Reader.<deviceList~callback>}
 */
const deviceList = (siteId = null) => reader(
  /**
   * @function deviceList~callback
   * @param {DB} DB
   * @param {FirmwareDal} firmwareDal
   * @param {DeviceStore} deviceStore
   * @param {DbDal} dal
   * @return {Promise.<ApiDeviceStatusOverview[]>}
   */
  ({ DB, firmwareDal, deviceStore, dal }) => {
    const dbDeviceMetadataListPromise = dal.deviceMetadataRepository.findAll();
    const unknownDeviceListPromise = resolveP(siteId)
      .then(ifElse(isNull, () => dal.macAesKeyRepository.findAll({}), stubArray))
      .then(map(castMacAesKeyToDevice({})));
    const dbDeviceListPromise = DB.device.findAll({ siteId });

    return allP([DB.site.list(), dbDeviceListPromise, unknownDeviceListPromise, dbDeviceMetadataListPromise])
      .then(([dbSiteList, dbDeviceList, dbUnknownDeviceList, dbDeviceMetadataList]) => {
        const deviceIdsMap = keyBy(get(['identification', 'id']), dbDeviceList);
        // TODO(michal.sedlak@ubnt.com): Remove when moving devices to PG
        const metadataIdsMap = keyBy(get(['id']), dbDeviceMetadataList);
        const missingMetadata = dbDeviceList.filter(dbDevice => !has(dbDevice.identification.id, metadataIdsMap));
        const devices = dbDeviceList.concat(filterUnknownDevices(deviceIdsMap, dbUnknownDeviceList));
        const data = { dbSiteList, devices, dbDeviceMetadataList };

        if (missingMetadata.length > 0) {
          return allP(missingMetadata.map(dbDevice => dal.deviceMetadataRepository.save({
            id: dbDevice.identification.id,
            failedMessageDecryption: false,
            restartTimestamp: null,
            alias: null,
            note: null,
          }))).then(constant(data));
        }

        return data;
      })
      .then(({ dbSiteList, devices, dbDeviceMetadataList }) =>
        fromDbDeviceList({ dbSiteList, firmwareDal, deviceStore }, devices)
          .chain(mergeRight(mergeMetadataList, fromDbDeviceMetadataList({}, dbDeviceMetadataList)))
          .chain(toApiDeviceStatusOverviewList)
          .cata(rejectP, resolveP)
      );
  }
);


/**
 * Device detail.
 */

const deviceDetail = deviceId => reader(
  ({ DB, dal }) => FutureTEither
    .do(function* async() {
      const dbDevice = yield FutureTEither.encaseP(DB.device.findById, deviceId)
        .mapRej(() => boom.notFound('Device not found'));
      const dbDeviceMetadata = yield FutureTEither.encaseP(dal.deviceMetadataRepository.findById, deviceId);
      const cmDevice = fromDbDevice({}, dbDevice);
      const cmDeviceMetadata = fromDbDeviceMetadata({}, dbDeviceMetadata);
      let apiDeviceStatusOverview = cmDevice
        .chain(merge(mergeMetadata, cmDeviceMetadata));

      const siteId = yield FutureTEither.fromEither(cmDevice).map(get(['identification', 'siteId']));

      if (siteId !== null) {
        const dbSite = yield FutureTEither.encaseP(DB.site.findById, siteId);
        apiDeviceStatusOverview = apiDeviceStatusOverview.chain(merge(mergeSite, fromDbSite({}, dbSite)));
      }

      return yield FutureTEither.fromEither(apiDeviceStatusOverview)
        .chainEither(toApiDeviceStatusOverview);
    })
    .promise()
);

/**
 * Restart device.
 */

const restartDevice = deviceId => reader(
  ({ DB, deviceStore, apiOnus, userId, messageHub, user, dal }) => {
    // thunkify non-primitive calls
    const restartOnuThunk = () => apiOnus.restartOnu(deviceId);
    const restartDeviceThunk = () => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.restartDevice())
      .toPromise();
    const { deviceRestarted } = messageHub.messages;

    const dbUserPromise = user
      .getUser(userId)
      .chainEither(toApiUser)
      .promise();
    const dbDevicePromise = DB.device.findById(deviceId);
    const dbDeviceMetadataPromise = dal.deviceMetadataRepository.findById(deviceId)
      .then(tapP(entityExistsCheck(EntityEnum.DeviceMetadata)));
    const dataPromise = allP([dbDevicePromise, dbUserPromise, dbDeviceMetadataPromise]);

    return dataPromise
      .then(head)
      .then(tap(entityExistsCheck(EntityEnum.Device)))
      .then(get(['identification', 'type']))
      .then(ifElse(
        eq(DeviceTypeEnum.Onu),
        restartOnuThunk,
        restartDeviceThunk
      ))
      .then(constant(dataPromise))
      .then(([dbDevice, dbUser, dbDeviceMetadata]) => allP([
        fromDbDevice({}, dbDevice)
          .chain(merge(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
          .cata(rejectP, resolveP),
        fromDbUser({}, dbUser).cata(rejectP, resolveP),
      ]))
      .then(([cmDevice, cmUser]) =>
        messageHub.publish(deviceRestarted(cmDevice, cmUser))
      )
      .then(constant({ result: true, message: 'Device restarted' }));
  }
);


/**
 * Upgrade firmware on device.
 */

/**
 * @param {string} userId
 * @param {string} deviceId
 * @return {Reader.<upgradeFirmwareToLatest~callback>}
 */
const upgradeFirmwareToLatest = (userId, deviceId) => reader(
  /**
   * @function upgradeFirmwareToLatest~callback
   * @param {ApiTasks} apiTasks
   * @param {FirmwareDal} firmwareDal
   * @param {DB} DB
   * @return {!Promise.<DbTask[]>}
   */
  ({ apiTasks, firmwareDal, DB }) => Observable.from(DB.device.findById(deviceId))
    .mergeEither(fromDbDevice({}))
    .mergeMap((cmDevice) => {
      const { platformId, firmwareVersion } = cmDevice.identification;
      const airMaxCustomScripts = hasCustomScriptsSupport(platformId, firmwareVersion);
      const currentFirmware = firmwareDal.findFirmwareDetails(platformId, firmwareVersion);
      const latestFirmware = firmwareDal.findLatestFirmware(platformId, { supports: { airMaxCustomScripts } });
      if (latestFirmware !== null && compareSemver(currentFirmware.semver.current, latestFirmware.semver) >= 0) {
        return rejectP(boom.badData('Already upgraded to latest version'));
      }

      return apiTasks.startTasks(userId, TaskTypeEnum.FirmwareUpgrade, [{
        deviceId,
        firmwareId: latestFirmware.identification.id,
      }]);
    })
    .toPromise()
);

const getSystem = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getSystem())
    .mergeEither(toApiSystem)
    .toPromise()
);

const setSystem = (deviceId, apiSystem) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiSystem(apiSystem))
      .mergeMap(cmSystem => commDevice.setSystem(cmSystem))
      .mergeEither(toApiSystem) // this is here because of timezone hack in getSystem
    )
    .toPromise()
);


const getServices = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getServices())
    .mergeEither(toApiServices)
    .toPromise()
);

const setServices = (deviceId, apiServices) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiServices(apiServices))
      .mergeMap(cmServices => commDevice.setServices(cmServices))
    )
    .mapTo(apiServices)
    .toPromise()
);


/**
 * Get list of a mac addresses of all devices registered in UNMS.
 */

const macAddressList = () => reader(
  ({ DB }) => allP([DB.olt.list(), DB.erouter.list(), DB.airCube.list(), DB.airMax.list()])
    .then(flatten)
    .then(macAddressListFromDbDeviceList)
    .then(chain(toApiMacAddressList))
    .then(cata(rejectP, resolveP))
);

/**
 * Reset an interface's statistics
 */

const resetInterfaceStatistics = (deviceId, interfaceName) => reader(
  ({ DB }) => FutureTEither
    .do(function* async() {
      const dbDevice = yield FutureTEither
        .encaseP(DB.device.findById, deviceId)
        .filter(isNotNull, boom.notFound(`Device(${deviceId}) not found`));

      const cmDeviceE = fromDbDevice({}, dbDevice);

      const cmInterfaceListE = cmDeviceE
        .map(get(['interfaces']))
        .chain(fromDbInterfaceList({ dbDevice }));

      const cmInterfaceE = cmInterfaceListE
        .map(find(pathEq(['identification', 'name'], interfaceName)))
        .chain(cmInterface => (
          isUndefined(cmInterface)
            ? Either.Left(boom.notFound(`Interface(${interfaceName}) on Device(${deviceId}) not found`))
            : Either.Right(cmInterface)
        ));

      return [cmDeviceE, cmInterfaceListE, cmInterfaceE];
    })
    .chainEither(([cmDeviceE, cmInterfaceListE, cmInterfaceE]) => cmDeviceE
      .chain(merge(mergeInterfaces, cmInterfaceListE
        .chain(merge(replaceInterfaceInList, cmInterfaceE
          .map(resetInterfaceStatisticsAp)
        ))
        .chain(toDbInterfaceList)
      ))
    )
    .chainEither(toDbDevice)
    .chain(FutureTEither.encaseP(DB.device.update))
    .map(constant({ result: true, message: 'Interface statistics reset' }))
    .promise()
);

/**
 * Get device specific UNMS settings
 */

/**
 * @param {string} deviceId
 * @return {Reader.<getDeviceUnmsSettings~callback>}
 */
const getDeviceUnmsSettings = deviceId => reader(
  /**
   * @param {DB} DB
   * @return {Promise.<ApiUnmsSettings>}
   */
  ({ deviceSettings }) => deviceSettings.loadSettings(deviceId)
    .mergeEither(toApiUnmsSettings)
    .toPromise()
);

/**
 * Update device specific UNMS settings
 */

/**
 * @param {string} deviceId
 * @param {ApiUnmsSettings} apiUnmsSettings
 * @return {Reader.<updateDeviceUnmsSettings~callback>}
 */
const updateDeviceUnmsSettings = (deviceId, apiUnmsSettings) => reader(
  /**
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {DeviceSettings} deviceSettings
   * @return {Promise.<ApiUnmsSettings>}
   */
  ({ DB, deviceStore, deviceSettings }) => {
    const cmDeviceUnmsSettings = fromApiUnmsSettings({}, apiUnmsSettings);

    return Observable.from(DB.device.findById(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeEither(fromDbDevice({}))
      .mergeEither(mergeRight(mergeDbDeviceUnmsSettings, cmDeviceUnmsSettings))
      .mergeEither(toDbDevice)
      .tapO(dbDevice => DB.device.update(dbDevice))
      .mergeEither(fromDbDeviceUnmsSettings)
      .tapO(() => Observable.of(deviceStore.get(deviceId))
        .filter(isNotNull)
        .mergeMap(commDevice => deviceSettings.loadSettings(deviceId)
          .mergeMap(unmsSettings => commDevice.setSetup(unmsSettings)))
      )
      .mergeEither(toApiUnmsSettings)
      .toPromise();
  });

/**
 * Update device metadata
 */

/**
 * @param {string} deviceId
 * @param {ApiDeviceMetadata} apiDeviceMetadata
 * @return {Reader.<updateDeviceSettingsMetadata~callback>}
 */
const updateDeviceSettingsMetadata = (deviceId, apiDeviceMetadata) => reader(
  /**
   * @param {dal} dal
   * @return {Promise.<ApiDeviceMetadata>}
   */
  ({ dal }) => {
    const { note, alias } = apiDeviceMetadata;

    return FutureTEither
      .fromEither(toDbDeviceMetadata({ id: deviceId, note, alias })
        .map(pick(['id', 'note', 'alias']))
        .chain(Future.encaseP(dal.deviceMetadataRepository.update))
        .promise());
  });

/**
 * Refresh device communication by deleting mac aes key from store and db
 * @param {guid} deviceId
 * @return {Status}
 */
const refreshDevice = deviceId => reader(
  ({ macAesKeyStore }) => macAesKeyStore.remove(deviceId)
    .then(constant({ result: true, message: 'Device refreshed' }))
);

/**
 * @return {Reader.<countUnauthorizedDevices~callback>}
 */
const countUnauthorizedDevices = () => reader(
  /**
   * @function countUnauthorizedDevices~callback
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @return {Promise.<number>}
   */
  ({ DB, deviceStore }) => allP([DB.olt.list(), DB.erouter.list(), DB.airCube.list(), DB.airMax.list()])
    .then(flatten)
    .then(fromDbDeviceList({ deviceStore }))
    .then(map(filter(pathEq(['overview', 'status'], StatusEnum.Unauthorized))))
    .then(map(size))
    .then(cata(rejectP, resolveP))
);

const listBackups = deviceId => reader(
  ({ DB }) => Observable.from(DB.device.findById(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(() => DB.device.listBackups(deviceId))
    .map(when(isNull, stubArray))
    .map(map(backup => assocPath(['timestamp'], Number(backup.timestamp), backup)))
    .toPromise()
);

const createBackup = deviceId => reader(
  ({ DB, backups, eventLog, deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(() => backups.deviceBackup.create(deviceId))
    .tapO(() => DB.device.findById(deviceId)
      .then(tap(entityExistsCheck(EntityEnum.Device)))
      .then(eventLog.logDeviceInfoEvent(LogTypeEnum.DeviceBackupCreate))
    )
    .toPromise()
);

module.exports = {
  deviceList,
  deviceDetail,
  restartDevice,
  upgradeFirmwareToLatest,
  macAddressList,
  resetInterfaceStatistics,
  getDeviceUnmsSettings,
  updateDeviceUnmsSettings,
  refreshDevice,
  countUnauthorizedDevices,
  updateDeviceSettingsMetadata,
  getSystem,
  setSystem,
  getServices,
  setServices,
  listBackups,
  createBackup,
};
