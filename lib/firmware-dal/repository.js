'use strict';

const { Reader: reader } = require('monet');
const { last, has } = require('lodash/fp');
const {
  view, isNil, ifElse, converge, concat, path, pathOr, pipe, always, equals, length, sort, dropLast,
} = require('ramda');
const { weave } = require('ramda-adjunct');
const { Observable } = require('rxjs/Rx');

const {
  firmwareOriginLens, firmwareFilenameLens, firmwareVersionLens, firmwareIdLens, firmwareUBNTComparator,
  firmwarePlatformIdLens, firmwareHasCustomScriptsSupportLens, firmwareComparator,
} = require('./utils');
const {
  isPlatformIdSupported, supportedUbntProducts, isFirmwareSupported, hasCustomScriptsSupport, isUBNTSemverNewer,
} = require('../feature-detection/firmware');
const { parseSemver, parseCommFirmwareVersion } = require('../transformers/semver/parsers');
const { viewOr, findLastOr } = require('../util');
const { compareSemver } = require('../util/semver');
const { parseUbntProductToPlatformId } = require('./image-parser/common');
const { FirmwareOriginEnum } = require('../enums');
const logging = require('../logging');

/**
 * @return {Reader.<findAll~callback>}
 */
const findAll = () => reader(
  /**
   * @function findAll~callback
   * @param {FirmwaresStore} firmwaresStore
   * @return {CorrespondenceFirmware[]}
   */
  ({ firmwaresStore }) => firmwaresStore.findAll()
);

/**
 * @param {string} firmwareId
 * @return {Reader.<findById~callback>}
 */
const findById = firmwareId => reader(
  /**
   * @function findById~callback
   * @param {FirmwaresStore} firmwaresStore
   * @return {?CorrespondenceFirmware}
   */
  ({ firmwaresStore }) => firmwaresStore.findById(firmwareId)
);

/**
 * @param {FirmwarePlatformIdEnum|string} platformId
 * @param {?Object|Function} [query]
 * @return {Reader.<findLatestFirmware~callback>}
 */
const findLatestFirmware = (platformId, query = null) => reader(
  /**
   * @function findLatestFirmware~callback
   * @param {FirmwaresStore} firmwaresStore
   * @return {?CorrespondenceFirmware}
   */
  ({ firmwaresStore }) => {
    const firmwares = firmwaresStore.findByPlatform(platformId);
    if (firmwares === null) { return null }

    if (query === null) {
      return last(firmwares);
    }

    return findLastOr(null, query, firmwares);
  }
);

/**
 * Firmware details
 *
 * @typedef {Object} DeviceFirmwareDetails
 * @property {string} current
 * @property {string} latest
 * @property {boolean} compatible
 * @property {Object} semver
 * @property {?CorrespondenceSemver} semver.current
 * @property {?CorrespondenceSemver} semver.latest
 */

/**
 * @param {FirmwarePlatformIdEnum|string} platformId
 * @param {string} rawVersion
 * @return {Reader.<findFirmwareDetails~callback>}
 */
const findFirmwareDetails = (platformId, rawVersion) => reader(
  /**
   * @function findFirmwareDetails~callback
   * @param {FirmwaresStore} firmwaresStore
   * @return {DeviceFirmwareDetails}
   */
  ({ firmwaresStore }) => {
    const currentVersion = parseCommFirmwareVersion(rawVersion);
    const currentSemver = parseSemver(currentVersion);

    if (!isPlatformIdSupported(platformId) || currentVersion === null) {
      return {
        current: rawVersion,
        latest: null,
        compatible: false,
        semver: {
          current: currentSemver,
          latest: null,
        },
      };
    }

    const hasUBNTFWCustomScripts = hasCustomScriptsSupport(platformId, currentVersion);
    const latestFirmware = findLatestFirmware(
      platformId,
      { supports: { airMaxCustomScripts: hasUBNTFWCustomScripts } }
    ).run({ firmwaresStore });

    const currentFirmwareVersion = pathOr(currentVersion, ['raw'], currentSemver);
    let latestFirmwareVersion = viewOr(null, firmwareVersionLens, latestFirmware);
    let latestFirmwareSemver = latestFirmwareVersion !== null ? latestFirmware.semver : null;

    // current firmware is newer or the same as the latest available
    if (latestFirmwareSemver === null || compareSemver(currentSemver, latestFirmwareSemver) >= 0) {
      latestFirmwareVersion = currentFirmwareVersion;
      latestFirmwareSemver = currentSemver;
    }

    return {
      current: currentFirmwareVersion,
      latest: latestFirmwareVersion,
      compatible: isFirmwareSupported(platformId, currentFirmwareVersion),
      semver: {
        current: currentSemver,
        latest: latestFirmwareSemver,
      },
    };
  }
);

/**
 * @param {FirmwareOriginEnum} origin
 * @param {stream.Readable} fileStream
 * @param {?string} md5
 * @return {Reader.<save~callback>}
 */
const save = (origin, fileStream, md5 = null) => reader(
  /**
   * @function save~callback
   * @param {FirmwaresStore} firmwaresStore
   * @param {FirmwaresStorage} firmwaresStorage
   * @return {Promise.<CorrespondenceFirmware>}
   */
  ({ firmwaresStore, firmwaresStorage }) => firmwaresStorage.save(origin, fileStream, md5)
    .then(firmware => firmwaresStore.save(firmware))
);

/**
 * @param {CorrespondenceFirmware} firmware
 * @return {Reader.<remove~callback>}
 */
const remove = firmware => reader(
  /**
   * @function remove~callback
   * @param {FirmwaresStore} firmwaresStore
   * @param {FirmwaresStorage} firmwaresStorage
   * @return {Promise.<CorrespondenceFirmware>}
   */
  ({ firmwaresStore, firmwaresStorage }) => {
    const firmwareId = view(firmwareIdLens, firmware);
    const filename = view(firmwareFilenameLens, firmware);
    const origin = view(firmwareOriginLens, firmware);

    return firmwaresStorage.remove(origin, filename)
      .then(() => firmwaresStore.remove(firmwareId));
  }
);

/**
 * @param {FirmwareOriginEnum} origin
 * @return {Reader.<remove~callback>}
 */
const removeAll = origin => reader(
  /**
   * @function removeAll~callback
   * @param {FirmwaresStore} firmwaresStore
   * @param {FirmwaresStorage} firmwaresStorage
   * @return {Promise.<void>}
   */
  ({ firmwaresStore, firmwaresStorage }) =>
    firmwaresStorage.removeAll(origin)
      .then(() => firmwaresStore.removeAll(origin))
);

/**
 * @param {FirmwareOriginEnum} origin
 * @return {Reader.<remove~callback>}
 */
const removeAllExceptLatest = origin => reader(
  /**
   * @function remove~callback
   * @param {FirmwaresStore} firmwaresStore
   * @param {FirmwaresStorage} firmwaresStorage
   * @return {Promise.<void>}
   */
  ({ firmwaresStore, firmwaresStorage }) =>
    Observable.from(firmwaresStore.findAll())
      .filter(fw => equals(origin, view(firmwareOriginLens, fw)))
      .groupBy(ifElse(
        pipe(view(firmwareHasCustomScriptsSupportLens), equals(true)),
        converge(concat, [view(firmwarePlatformIdLens), always('-cs')]),
        view(firmwarePlatformIdLens)
      ))
      .mergeMap(group => group.toArray()
        .map(pipe(
          sort(firmwareComparator),
          dropLast(1)
        ))
      )
      .mergeAll()
      .mergeMap(weave(remove, { firmwaresStore, firmwaresStorage }))
  );

/**
 * @return {Reader.<fetchNewFirmwares~callback>}
 */
const fetchNewFirmwares = () => reader(
  /**
   * @function fetchNewFirmwares~callback
   * @param {FirmwaresStore} firmwaresStore
   * @param {FirmwaresStorage} firmwaresStorage
   * @param {FirmwaresRequest} firmwaresRequest
   * @param {FirmwaresConfig} firmwaresConfig
   * @return {Array<Observable<CorrespondenceFirmware>>}
   */
  ({ firmwaresStore, firmwaresStorage, firmwaresConfig, firmwaresRequest }) => {
    const { fetchUbntFirmwaresConcurrency } = firmwaresConfig();

    return firmwaresRequest.fetchUBNTFirmwares()
      .mergeAll()
      .groupBy(ifElse(
        has(['version_prerelease']),
        converge(concat, [path(['product']), path(['version_prerelease'])]),
        path(['product'])
      ))
      .filter(group => supportedUbntProducts.has(group.key))
      .mergeMap(group => group.max(firmwareUBNTComparator))
      .mergeMap((fw) => {
        const platformId = parseUbntProductToPlatformId(fw.product);
        const firmwareUrl = pathOr(null, ['_links', 'data', 'href'], fw);
        if (firmwareUrl === null) {
          return Observable.empty();
        }
        const hasUBNTFWCustomScripts = hasCustomScriptsSupport(platformId, fw.version);
        const latestFirmware = findLatestFirmware(
          platformId,
          {
            identification: { origin: FirmwareOriginEnum.UBNT },
            supports: { airMaxCustomScripts: hasUBNTFWCustomScripts },
          }
        ).run({ firmwaresStore });

        if (has(['semver', 'version'], latestFirmware) && isUBNTSemverNewer(latestFirmware, fw)) {
          logging.info(`Firmware: Found an updated version for ${fw.product}: ${fw.version}`);
          return Observable.from(
            save(FirmwareOriginEnum.UBNT, firmwaresRequest.downloadFirmware(firmwareUrl), fw.md5)
              .run({ firmwaresStore, firmwaresStorage })
              .catch(() => Observable.empty()) // ignore errors
          );
        }

        if (isNil(latestFirmware)) {
          logging.info(`Firmware: Found a new version for ${fw.product}: ${fw.version}`);
          return Observable.from(
            save(FirmwareOriginEnum.UBNT, firmwaresRequest.downloadFirmware(firmwareUrl), fw.md5)
              .run({ firmwaresStore, firmwaresStorage })
              .catch(() => Observable.empty()) // ignore errors
          );
        }
        return Observable.empty();
      }, fetchUbntFirmwaresConcurrency)
      .toArray();
  }
);

/**
 * @return {Reader.<downloadAndCleanUbntFirmwares~callback>}
 */
const downloadAndCleanUbntFirmwares = () => reader(
  /**
   * @function downloadAndCleanUbntFirmwares~callback
   * @param {FirmwaresStore} firmwaresStore
   * @param {FirmwaresStorage} firmwaresStorage
   * @param {FirmwaresRequest} firmwaresRequest
   * @param {FirmwaresConfig} firmwaresConfig
   * @return {Subscription}
   */
  ({ firmwaresStore, firmwaresStorage, firmwaresRequest, firmwaresConfig }) => Observable.concat(
      fetchNewFirmwares().run({ firmwaresStore, firmwaresStorage, firmwaresRequest, firmwaresConfig }),
      removeAllExceptLatest(FirmwareOriginEnum.UBNT).run({ firmwaresStore, firmwaresStorage })
    ).ignoreElements()
);

/**
 * @param {number} timestamp
 * @return {Reader.<countUnread~callback>}
 */
const countUnread = timestamp => reader(
  /**
   * @function countUnread~callback
   * @param {FirmwaresStore} firmwaresStore
   * @return {Promise.<number>}
   */
  ({ firmwaresStore }) => pipe(
    firmwaresStore.findAddedAfter.bind(firmwaresStore),
    length
  )(timestamp)
);

module.exports = {
  findAll,
  findById,
  findLatestFirmware,
  findFirmwareDetails,
  save,
  remove,
  removeAll,
  removeAllExceptLatest,
  fetchNewFirmwares,
  downloadAndCleanUbntFirmwares,
  countUnread,
};
