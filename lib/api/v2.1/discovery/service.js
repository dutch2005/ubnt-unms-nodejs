'use strict';

const { Reader: reader, Either } = require('monet');
const { tap, constant, forEach, flatten, join, stubArray, partial, filter } = require('lodash/fp');
const { invoker, chain, map, pipeP, pathSatisfies } = require('ramda');
const { cata } = require('ramda-adjunct');
const boom = require('boom');
const url = require('url');
const ip = require('ip');

const { DiscoveryMethodEnum, DiscoveryConnectStatusEnum, ProgressStatusEnum } = require('../../../enums');
const { rejectP, resolveP, allP, entityExistsCheck } = require('../../../util');
const { merge, mergeRight } = require('../../../transformers');
const { fromDbList: fromDbDeviceList } = require('../../../transformers/device');
const { fromDbList: fromDbDiscoveryDeviceList } = require('../../../transformers/discovery/device');
const {
  fromDb: fromDbDiscoveryResult, fromApiPayload: fromApiDiscoveryResultPayload, toApi: toApiDiscoveryResult,
  toDb: toDbDiscoveryResult,
} = require('../../../transformers/discovery/result');
const { mergeWithDiscoveryDeviceList } = require('../../../transformers/discovery/result/mergers');
const { mergeCorrespondenceDeviceList } = require('../../../transformers/discovery/device/mergers');

const run = invoker(1, 'run');

/**
 * @param {CorrespondenceDiscoveryResult} cmDiscoveryResult
 * @return {withDeviceList~callback}
 */
const withDeviceList = cmDiscoveryResult => reader(
  /**
   * @function withDeviceList~callback
   * @param {DbDal} dal
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {Discovery} discovery
   * @param {FirmwareDal} firmwareDal
   * @param {string} userId
   * @return {Promise.<Either.<Error, CorrespondenceDiscoveryResult>>}
   */
  ({ dal, DB, deviceStore, discovery, firmwareDal, userId }) => allP([
    dal.discoveryDeviceRepository.findAll({ where: { userId, resultId: cmDiscoveryResult.id } }),
    DB.device.list(),
  ])
    .then(([dbDiscoveryDeviceList, dbDeviceList]) =>
      fromDbDiscoveryDeviceList({ firmwareDal, discovery }, dbDiscoveryDeviceList)
        .chain(mergeRight(mergeCorrespondenceDeviceList, fromDbDeviceList({ deviceStore, firmwareDal }, dbDeviceList)))
        .chain(merge(mergeWithDiscoveryDeviceList, Either.of(cmDiscoveryResult)))
    )
);

/**
 * @param {string} userId
 * @return {discoveryResult~callback}
 */
const discoveryResult = userId => reader(
  /**
   * @function discoveryResult~callback
   * @param {DbDal} dal
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {Discovery} discovery
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<ApiDiscoveryResult>}
   */
  ({ dal, DB, deviceStore, discovery, firmwareDal }) => pipeP(
    dal.discoveryResultRepository.findByUserId,
    tap(entityExistsCheck('Discovery result')),
    fromDbDiscoveryResult({}),
    cata(rejectP, withDeviceList),
    run({ dal, DB, deviceStore, firmwareDal, discovery, userId }),
    chain(toApiDiscoveryResult),
    cata(rejectP, resolveP)
  )(userId)
);

/**
 * @param {string} userId
 * @return {removeDiscoveryResult~callback}
 */
const removeDiscoveryResult = userId => reader(
  /**
   * @function removeDiscoveryResult~callback
   * @param {DbDal} dal
   * @return {Promise.<ApiDiscoveryResult>}
   */
  ({ dal }) => dal.discoveryResultRepository.remove(userId)
    .then(constant({ message: 'Result deleted', result: true }))
);

const registerCredentials = ({ ip: ipAddress, username, password, sshPort, httpsPort }) => reader(
  ({ discovery, userId }) => {
    if (username === null) { return }

    discovery.credentials.set(userId, ipAddress, { username, password, sshPort, httpsPort });
  }
);

const startDiscoveryScan = (userId, { method, single, range, list }) => reader(
  ({ dal, discovery, discoveryScanTimeout }) => {
    if (method === DiscoveryMethodEnum.Import) {
      list.map(registerCredentials).forEach(run({ discovery, userId }));
    } else if (method === DiscoveryMethodEnum.IpRange) {
      const publicIpCount = discovery.scanner.publicIpRangesSize(range.parsed);
      if (publicIpCount > 255) {
        return rejectP(boom.badData('Ip range has more than 255 public IP addresses'));
      }
    }

    discovery.scanner.cancelScan(userId);

    return pipeP(
      dal.discoveryResultRepository.remove,
      () => fromApiDiscoveryResultPayload({ userId }, { method, single, range, list }),
      chain(toDbDiscoveryResult),
      cata(rejectP, dal.discoveryResultRepository.save),
      fromDbDiscoveryResult({}),
      tap(map(partial(discovery.scanner.requestScan, [discoveryScanTimeout()]))),
      chain(toApiDiscoveryResult),
      cata(rejectP, resolveP)
    )(userId);
  }
);

const stopDiscoveryScan = userId => reader(
  ({ dal, DB, deviceStore, firmwareDal, discovery }) => {
    discovery.scanner.cancelScan(userId);

    return pipeP(
      dal.discoveryResultRepository.updateStatus,
      tap(entityExistsCheck('Discovery result')),
      fromDbDiscoveryResult({}),
      cata(rejectP, withDeviceList),
      run({ dal, DB, deviceStore, firmwareDal, discovery, userId }),
      chain(toApiDiscoveryResult),
      cata(rejectP, resolveP)
    )(userId, ProgressStatusEnum.Canceled);
  }
);

const assignCredentials = (userId, deviceIds, credentials) => reader(
  ({ dal, discovery }) => pipeP(
    dal.discoveryDeviceRepository.batchUpdate,
    fromDbDiscoveryDeviceList({}),
    map(forEach((cmDiscoveryDevice) => {
      discovery.credentials.set(userId, cmDiscoveryDevice.id, credentials);
      discovery.authenticator.requestCheck(cmDiscoveryDevice);
    })),
    constant({ message: 'Credentials set', result: true })
  )(deviceIds, userId, {
    authenticationStatus: ProgressStatusEnum.InProgress,
    authenticationError: null,
  })
);

const connectDevices = (userId, deviceIds, preferences) => reader(
  ({ dal, discovery }) => pipeP(
    dal.discoveryDeviceRepository.batchUpdate,
    fromDbDiscoveryDeviceList({}),
    map(forEach(discovery.connector.requestConnect)),
    constant({ message: 'Connecting', result: true })
  )(deviceIds, userId, {
    preferences,
    connectStatus: DiscoveryConnectStatusEnum.Pending,
    connectProgress: null,
    connectError: null,
  })
);

const suggestIpRange = () => reader(
  ({ DB, discovery, unmsHostname }) => {
    const hostname = url.parse(unmsHostname()).hostname;
    const guessIpRange = discovery.guessIpRange;

    const fromHostnamePromise = guessIpRange.fromHostname(hostname).catch(stubArray); // ignore errors
    const fromPhysicalInterfaces = guessIpRange.fromPhysicalInterfaces();
    const fromDevicesPromise = DB.device.list()
      .then(fromDbDeviceList({}))
      .then(cata(rejectP, guessIpRange.fromDevices))
      .catch(stubArray); // ignore errors

    return pipeP(
      allP,
      flatten,
      guessIpRange.collapseSubnets,
      filter(pathSatisfies(ip.isPrivate, ['networkAddress'])),
      map(({ networkAddress, subnetMaskLength }) => `${networkAddress}/${subnetMaskLength}`),
      join(', ')
    )([fromHostnamePromise, fromDevicesPromise, fromPhysicalInterfaces]);
  }
);

module.exports = {
  discoveryResult,
  removeDiscoveryResult,
  startDiscoveryScan,
  stopDiscoveryScan,
  assignCredentials,
  connectDevices,
  suggestIpRange,
};
