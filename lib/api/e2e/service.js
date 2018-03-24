'use strict';

const { Reader: reader, Either } = require('monet');
const { weave } = require('ramda-adjunct');
const { evolve, map } = require('ramda');
const FutureTEither = require('monad-t/lib/FlutureTMonetEither');

const { merge, mergeRight } = require('../../transformers');
const { fromDbList: fromDbDeviceList } = require('../../transformers/device');
const { fromDbList: fromDbDiscoveryDeviceList } = require('../../transformers/discovery/device');
const { fromDbList: fromDbDiscoveryResultList } = require('../../transformers/discovery/result');
const { mergeWithDiscoveryDeviceList } = require('../../transformers/discovery/result/mergers');
const { mergeCorrespondenceDeviceList } = require('../../transformers/discovery/device/mergers');
const { fromDbList: fromDbMacAesKeyList } = require('../../transformers/mac-aes-key');


/**
 * @param {CorrespondenceDiscoveryResult} cmDiscoveryResult
 * @return {loadDiscoveryDeviceList~callback}
 */
const loadDiscoveryDeviceList = cmDiscoveryResult => reader(
  /**
   * @function loadDiscoveryDeviceList~callback
   * @param {DbDal} dal
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {Discovery} discovery
   * @param {FirmwareDal} firmwareDal
   * @return {FutureTEither.<CorrespondenceDiscoveryDevice>}
   */
  ({ dal, DB, deviceStore, discovery, firmwareDal }) => FutureTEither.do(function* async() {
    const [dbDiscoveryDeviceList, dbDeviceList] = yield FutureTEither.both(
      FutureTEither.encaseP(dal.discoveryDeviceRepository.findAll, { where: { resultId: cmDiscoveryResult.id } }),
      FutureTEither.tryP(DB.device.list)
    );

    const cmDiscoveryDevicelist = fromDbDiscoveryDeviceList({ firmwareDal, discovery }, dbDiscoveryDeviceList)
      .chain(mergeRight(mergeCorrespondenceDeviceList, fromDbDeviceList({ deviceStore, firmwareDal }, dbDeviceList)))
      .chain(merge(mergeWithDiscoveryDeviceList, Either.of(cmDiscoveryResult)));

    return yield FutureTEither.fromEither(cmDiscoveryDevicelist);
  })
);

/**
 * @return {Reader.<getAesKeys~callback>}
 */
const getAesKeys = () => reader(
  /**
   * @function getAesKeys~callback
   * @param {DbDal} dal
   * @return {Promise.<CorrespondenceMacAesKey[]>}
   */
  ({ dal }) => FutureTEither.tryP(dal.macAesKeyRepository.findAll)
    .chainEither(fromDbMacAesKeyList({}))
    .map(map(evolve({
      key: key => key.toString('base64'),
    })))
    .promise()
);

/**
 * @return {Reader.<getDiscoveryResults~callback>}
 */
const getDiscoveryResults = () => reader(
  /**
   * @function getDiscoveryResults~callback
   * @param {DbDal} dal
   * @param {DB} DB
   * @param {DeviceStore} deviceStore
   * @param {Discovery} discovery
   * @param {FirmwareDal} firmwareDal
   * @return {Promise.<CorrespondenceDiscoveryResult[]>}
   */
  ({ dal, DB, deviceStore, discovery, firmwareDal }) => FutureTEither.tryP(dal.discoveryResultRepository.findAll)
    .chainEither(fromDbDiscoveryResultList({}))
    .chain(resultsList => FutureTEither.parallel(
      Infinity, resultsList.map(weave(loadDiscoveryDeviceList, { dal, DB, deviceStore, discovery, firmwareDal }))
    ))
    .promise()
);

module.exports = {
  getAesKeys,
  getDiscoveryResults,
};
