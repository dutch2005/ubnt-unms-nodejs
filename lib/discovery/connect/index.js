'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Reader, Either } = require('monet');
const { isNil, flow, identity, first, defaultTo } = require('lodash/fp');
const { both, pathEq, ifElse, pipeP, chain } = require('ramda');
const { isNotNull, cata, stubNull } = require('ramda-adjunct');

require('../../util/observable');
const log = require('../../logging');
const { toMs, pathNotEq } = require('../../util');
const { merge } = require('../../transformers');
const { fromDb } = require('../../transformers/device');
const { mergeCorrespondenceDevice } = require('../../transformers/discovery/device/mergers');
const { DiscoveryConnectStatusEnum, DiscoveryConnectProgressEnum, DeviceTypeEnum, StatusEnum } = require('../../enums');

const erouterConnector = require('./erouter');
const eswitchConnector = require('./eswitch');
const oltConnector = require('./olt');
const airMaxConnector = require('./airmax');
const airCubeConnector = require('./aircube');

const DEVICE_CONNECT_TIMEOUT = toMs('second', 30);
const DEVICE_CONNECT_CHECK_DELAY = toMs('second', 1);

/**
 * @typedef {Function} ConnectMethod
 * @param {CorrespondenceDiscoveryDevice} device
 * @param {AuthCredentials} authCredentials
 * @return {Reader.<Observable.<CorrespondenceDiscoveryDevice>>}
 */

/**
 * @typedef {Object} DeviceConnector
 * @property {ConnectMethod} connect
 */

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {DeviceConnector}
 */
const connectorForDevice = (cmDiscoveryDevice) => {
  switch (cmDiscoveryDevice.type) {
    case DeviceTypeEnum.Erouter:
      return erouterConnector;
    case DeviceTypeEnum.Eswitch:
      return eswitchConnector;
    case DeviceTypeEnum.Olt:
      return oltConnector;
    case DeviceTypeEnum.AirMax:
      return airMaxConnector;
    case DeviceTypeEnum.AirCube:
      return airCubeConnector;
    default:
      return {
        connect: () => Reader.of(Observable.throw(new Error('Unsupported device type'))),
      };
  }
};

/**
 * @param {string[]} possibleIds
 * @return {Reader.<findDeviceInUnms~callback>}
 */
const findDeviceInUnms = possibleIds => reader(
  /**
   * @function findDeviceInUnms~callback
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @return {Promise.<Either.<Error, CorrespondenceDevice>>}
   */
  ({ DB, deviceStore }) => DB.device.deviceIdsExist(possibleIds)
    .then(flow(first, defaultTo(null)))
    .then(ifElse(isNotNull, pipeP(DB.device.findById, Either.of), Either.Left))
    .then(chain(fromDb({ deviceStore })))
);

/**
 * @function isCorrespondenceDeviceConnected
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {boolean}
 */
const isDiscoveryDeviceConnected = both(
  isNotNull,
  pathEq(['connectStatus'], DiscoveryConnectStatusEnum.Connected)
);

/**
 * @function isDeviceConnected
 * @param {CorrespondenceDevice} cmDevice
 * @return {boolean}
 */
const isDeviceConnected = both(
  isNotNull,
  pathNotEq(['overview', 'status'], StatusEnum.Disconnected)
);

/**
 * @function isDeviceDisconnected
 * @param {CorrespondenceDevice} cmDevice
 * @return {boolean}
 */
const isDeviceDisconnected = pathEq(['overview', 'status'], StatusEnum.Disconnected);

const prepareDeviceConnection = cmDiscoveryDevice => reader(
  ({ DB, deviceStore, macAesKeyStore }) => Observable
    .fromPromise(findDeviceInUnms(cmDiscoveryDevice.possibleIds).run({ deviceStore, DB }))
    .map(cata(stubNull, identity))
    .mergeMap((cmDevice) => {
      if (isDeviceConnected(cmDevice)) {
        return Observable.throw(new Error('Device already connected'));
      } else if (isDeviceDisconnected(cmDevice)) {
        return Observable.from(macAesKeyStore.remove(cmDevice.identification.id))
          .mapTo(cmDevice);
      }

      return Observable.from(cmDiscoveryDevice.possibleIds)
        .mergeMap(possibleId => macAesKeyStore.remove(possibleId))
        .ignoreElements()
        .concat(Observable.of(cmDevice));
    })
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<waitForDeviceConnection~callback>}
 */
const waitForDeviceConnection = cmDiscoveryDevice => reader(
  /**
   * @function waitForDeviceConnection~callback
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @return {Observable}
   */
  ({ DB, deviceStore }) => Observable
    .defer(() => findDeviceInUnms(cmDiscoveryDevice.possibleIds)
      .run({ DB, deviceStore })
      .then(chain(merge(mergeCorrespondenceDevice, Either.of(cmDiscoveryDevice))))
      .then(cata(stubNull, identity))
    )
    .repeatWhen(notifications => notifications.delay(DEVICE_CONNECT_CHECK_DELAY))
    .first(isDiscoveryDeviceConnected)
    .timeoutWith(DEVICE_CONNECT_TIMEOUT, Observable.throw(new Error('Waiting for device connect timeout')))
);


/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {Reader.<performConnect~callback>}
 */
const performConnect = cmDiscoveryDevice => reader(
  /**
   * @function performConnect~callback
   * @param {DB} DB
   * @param {FirmwareDal} firmwareDal
   * @param {DeviceStore} deviceStore
   * @param {DiscoveryCredentials} credentials
   * @param {DiscoveryStatusUpdater} statusUpdater
   * @param {MacAesKeyStore} macAesKeyStore
   * @param {Function} connectionStringProvider
   * @return {Observable.<R>}
   */
  ({ firmwareDal, deviceStore, DB, credentials, statusUpdater, macAesKeyStore, connectionStringProvider }) => {
    const { userId } = cmDiscoveryDevice;
    const authCredentials = credentials.get(userId, [cmDiscoveryDevice.id, cmDiscoveryDevice.ip]);

    if (authCredentials === null) {
      return statusUpdater.missingCredentials(cmDiscoveryDevice);
    }

    return prepareDeviceConnection(cmDiscoveryDevice)
      .run({ DB, deviceStore, macAesKeyStore })
      .mergeMap(() => connectorForDevice(cmDiscoveryDevice)
        .connect(cmDiscoveryDevice, authCredentials)
        .run({ firmwareDal, statusUpdater, connectionStringProvider }))
      .tapO(() => statusUpdater.updateConnectProgress(cmDiscoveryDevice, DiscoveryConnectProgressEnum.Waiting))
      .switchMap(() => waitForDeviceConnection(cmDiscoveryDevice).run({ DB, deviceStore }))
      .mergeMap(statusUpdater.connectSuccessful)
      .catch(statusUpdater.connectFailed.bind(null, cmDiscoveryDevice))
      .catch((err) => {
        log.error('Unexpected connector error', err);
        return Observable.empty(); // ignore all errors
      });
  }
);

/**
 * @param {CorrespondenceDiscoveryDevice} cmDiscoveryDevice
 * @return {void}
 */
const requestConnect = cmDiscoveryDevice => reader(
  (connector) => {
    if (isNil(cmDiscoveryDevice)) { return }
    connector.enqueue(`${cmDiscoveryDevice.id}~${cmDiscoveryDevice.userId}`, cmDiscoveryDevice);
  }
);

/**
 * @param {string} deviceId
 * @param {string} userId
 * @return {void}
 */
const cancelConnect = (deviceId, userId) => reader(
  connector => connector.cancel(`${deviceId}~${userId}`)
);

module.exports = { requestConnect, cancelConnect, performConnect };
