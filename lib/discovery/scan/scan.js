'use strict';

const { Reader: reader, Either, Maybe } = require('monet');
const { constant, get, spread, has, tap, flow, first, stubFalse, overEvery, identity } = require('lodash/fp');
const { pathSatisfies, when, chain, invoker, find, curry, assoc } = require('ramda');
const { isNotNull, isNotUndefined, cata } = require('ramda-adjunct');
const { Observable } = require('rxjs/Rx');

const { merge, mergeRight } = require('../../transformers');
const { fromDb: fromDbDiscoveryDevice, toDb: toDbDiscoveryDevice } = require('../../transformers/discovery/device');
const {
  mergeCorrespondenceDevice, mergeDiscoveryResult, mergeDbAndHwDiscoveryDevice,
} = require('../../transformers/discovery/device/mergers');
const { fromDb: fromDbDevice } = require('../../transformers/device');
const { DiscoveryMethodEnum, ProgressStatusEnum, DiscoveryConnectStatusEnum } = require('../../enums');
const { allP, resolveP, rejectP } = require('../../util');
const { error: logError } = require('../../logging');
const { AddressList } = require('../utils');
const { isPacketValid, safeParsePacket } = require('./packet-parser');
const addressListScan = require('./method/address-list');
const pingListScan = require('./method/ping-address-list');

/*
 * Helpers
 */
const cataIdentityOrNull = cata(constant(null), identity);
const run = invoker(1, 'run');
const right = invoker(0, 'right');

/**
 * @param {CorrespondenceDiscoveryResult} correspondenceDiscoveryResult
 * @param {number} scanTimeout
 * @return {Observable}
 */
const createAddressList = (correspondenceDiscoveryResult) => {
  switch (correspondenceDiscoveryResult.method) {
    case DiscoveryMethodEnum.Import:
      return AddressList.fromList(correspondenceDiscoveryResult.ipList);
    case DiscoveryMethodEnum.IpRange:
      return AddressList.fromRanges(correspondenceDiscoveryResult.ipRangeParsed);
    default:
      return [];
  }
};

/**
 * @param {Either.<Error, CorrespondenceDiscoveryDevice>} discoveryDeviceCorrespondence
 * @return {boolean}
 */
const isDeviceSupported = cata(stubFalse, overEvery([
  has('mac'),
  pathSatisfies(isNotNull, ['model']),
  pathSatisfies(isNotNull, ['firmwareVersion']),
  pathSatisfies(isNotNull, ['platformId']),
]));

/**
 * Packet -> valid CorrespondenceDiscoveryDevice
 *
 * Put all necessary transformations here
 *
 * @param {Observable.<dgram.Socket>} socketObservable
 * @return {Observable.<CorrespondenceDiscoveryDevice>}
 */
const collectDevices = socketObservable => socketObservable
  .filter(spread(isPacketValid))
  .map(spread(safeParsePacket))
  .filter(isDeviceSupported)
  .map(right)
  .distinct(get('mac')) // filter by MAC address
;

/**
 * @param {CorrespondenceDiscoveryDevice} hwCorrespondenceDiscoveryDeviceData
 * @return {Reader.<saveDiscoveredDevice~callback>}
 */
const saveDiscoveredDevice = hwCorrespondenceDiscoveryDeviceData => reader(
  /**
   * @function saveDiscoveredDevice~callback
   * @param {DbDal} dal
   * @param {DeviceStore} deviceStore
   * @param {DB} DB
   * @param {CorrespondenceDiscoveryResult} correspondenceDiscoveryResult
   * @return {CorrespondenceDiscoveryDevice}
   */
  ({ dal, deviceStore, DB, correspondenceDiscoveryResult }) => {
    const possibleIds = hwCorrespondenceDiscoveryDeviceData.possibleIds;
    const hwCorrespondenceDiscoveryDevice = Either.Right(hwCorrespondenceDiscoveryDeviceData);

    const correspondenceDevicePromise = DB.device.deviceIdsExist(possibleIds)
      .then(flow(first, when(isNotUndefined, DB.device.findById)))
      .then(fromDbDevice({ deviceStore }))
      .catch(Either.Left)
      .then(cataIdentityOrNull);

    const discoveryDeviceCorrespondencePromise = dal.discoveryDeviceRepository
      .findOne({ where: { possibleIds: { $overlap: possibleIds }, userId: correspondenceDiscoveryResult.userId } })
      .then((dbDiscoveryDevice) => {
        if (dbDiscoveryDevice === null) { return hwCorrespondenceDiscoveryDevice }

        return hwCorrespondenceDiscoveryDevice
          .chain(merge(mergeDbAndHwDiscoveryDevice, fromDbDiscoveryDevice({}, dbDiscoveryDevice)));
      });

    return allP([correspondenceDevicePromise, discoveryDeviceCorrespondencePromise])
      .then(([correspondenceDevice, correspondenceDiscoveryDevice]) => Maybe
        .fromNull(correspondenceDevice)
        .map(merge(mergeCorrespondenceDevice, correspondenceDiscoveryDevice))
        .orSome(correspondenceDiscoveryDevice)
      )
      .then(chain(mergeRight(mergeDiscoveryResult, Either.Right(correspondenceDiscoveryResult))))
      .then(chain(toDbDiscoveryDevice))
      .then(cata(rejectP, dal.discoveryDeviceRepository.save))
      .then(fromDbDiscoveryDevice({}))
      .then(cata(rejectP, resolveP));
  }
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<updateAuthentication~callback>}
 */
const updateAuthentication = cmDiscoveryDevice => reader(
  /**
   * @name updateAuthentication~callback
   * @param {Object} authenticator
   * @param {Object} credentials
   * @param {DbDal} dal
   * @return {Promise.<CorrespondenceDiscoveryDevice>}
   */
  ({ authenticator, credentials, dal }) => {
    const sshCredentials = credentials.get(cmDiscoveryDevice.userId, [cmDiscoveryDevice.ip, cmDiscoveryDevice.id]);
    if (
      sshCredentials !== null &&
      cmDiscoveryDevice.authenticationStatus !== ProgressStatusEnum.InProgress &&
      cmDiscoveryDevice.connectStatus !== DiscoveryConnectStatusEnum.Connected &&
      cmDiscoveryDevice.connectStatus !== DiscoveryConnectStatusEnum.Pending
    ) {
      return dal.discoveryDeviceRepository.update({
        id: cmDiscoveryDevice.id,
        userId: cmDiscoveryDevice.userId,
        authenticationStatus: ProgressStatusEnum.InProgress,
        authenticationError: null,
      })
        .then(fromDbDiscoveryDevice({}))
        .then(cata(rejectP, resolveP))
        .then(tap(authenticator.requestCheck));
    }

    return resolveP(cmDiscoveryDevice);
  }
);

/**
 * @param {DbDal} dal
 * @param {string} userId
 * @param {Error} err
 * @return {Promise.<DbDiscoveryResult>}
 */
const handleScanError = (dal, userId, err) =>
  dal.discoveryResultRepository.updateStatus(userId, ProgressStatusEnum.Failed, `${err || 'Unknown error'}`);

/**
 * @param {DbDal} dal
 * @param {string} userId
 * @return {Promise.<DbDiscoveryResult>}
 */
const handleScanSuccess = (dal, userId) =>
  dal.discoveryResultRepository.updateStatus(userId, ProgressStatusEnum.Success);

/**
 * @param {DbDal} dal
 * @param {string} userId
 * @return {Promise.<DbDiscoveryResult>}
 */
const handleScanCancel = (dal, userId) =>
  dal.discoveryResultRepository.updateStatus(userId, ProgressStatusEnum.Canceled);

/**
 * @param {AddressList} addressList
 * @param {CmDiscoveryDevice} cmDiscoveryDevice
 * @return {CmDiscoveryDevice}
 *
 * This method deals with potential network issues related to routing
 * as well as device being presented as having IP address outside of
 * the scanning range. For inquiry contact <michael.kuk@ubnt.com>
 */
const remapIp = curry((addressList, cmDiscoveryDevice) => {
  const newIp = find(pathSatisfies(ip => addressList.contains(ip), ['ip']), cmDiscoveryDevice.addresses);

  if (isNotUndefined(newIp)) {
    return assoc('ip', newIp.ip, cmDiscoveryDevice);
  }

  return cmDiscoveryDevice;
});

/**
 * @param {CorrespondenceDiscoveryResult} correspondenceDiscoveryResult
 * @param {number} scanTimeout
 * @return {Observable}
 */
const performScan = ({ correspondenceDiscoveryResult, scanTimeout }) => reader(
  /**
   * @param {DbDal} dal
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {DiscoveryCredentials} credentials
   * @param {*} authenticator
   * @return {Observable.<*>}
   */
  ({ dal, DB, deviceStore, credentials, authenticator }) => {
    const userId = correspondenceDiscoveryResult.userId;
    let scanSuccessful = false;

    const addressList = createAddressList(correspondenceDiscoveryResult);

    return pingListScan(addressList)
      .let(ips$ => addressListScan(ips$, scanTimeout))
      .let(collectDevices)
      // sanintize device IP
      .map(remapIp(addressList))
      // save device
      .map(saveDiscoveredDevice)
      .mergeMap(run({ dal, DB, deviceStore, correspondenceDiscoveryResult }))
      // update authentication status if possible
      .map(updateAuthentication)
      .mergeMap(run({ dal, credentials, authenticator }))
      // when the scan is finished, update result
      .concat(Observable.defer(() => handleScanSuccess(dal, userId))
        .ignoreElements() // propagate only errors
        .do({ complete() { scanSuccessful = true } }))
      .do({
        error(err) {
          handleScanError(dal, userId, err)
            .catch((innerErr) => {
              logError('Error during discovery scan error', innerErr);
            });
        },
        complete() {
          if (!scanSuccessful) { // scan has been canceled
            handleScanCancel(dal, userId) // handle status update
              .catch((err) => {
                logError('Error during discovery scan cancel', err);
              });
          }
        },
      });
  }
);

/**
 * @param {number} scanTimeout
 * @param {DbDiscoveryResult} correspondenceDiscoveryResult
 * @return {void}
 */
const requestScan = (scanTimeout, correspondenceDiscoveryResult) => reader(
  scanner => scanner.enqueue(correspondenceDiscoveryResult.userId, { correspondenceDiscoveryResult, scanTimeout })
);

/**
 * @param {string} userId
 * @return {void}
 */
const cancelScan = userId => reader(
  scanner => scanner.cancel(userId)
);

module.exports = { performScan, requestScan, cancelScan };

