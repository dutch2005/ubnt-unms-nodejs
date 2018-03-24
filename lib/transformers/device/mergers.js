'use strict';

const {
  assocPath, unapply, converge, pipe, pathEq, find, identity, pair, fromPairs, merge, reduce, pathSatisfies,
} = require('ramda');
const { isNull, mergeAllWith, keyBy, get, getOr, map, spread } = require('lodash/fp');

const { mergeHwAndDbLists } = require('../interfaces/mergers');

// TODO(michal.sedlak@ubnt.com): Not used anymore, site mapping is directly in the parser

// mergeSite :: (Object, Object) -> DeviceCorrespondence
//     DeviceCorrespondence = Object
const mergeSite = (deviceCorrespondence, siteCorrespondence) => {
  if (isNull(siteCorrespondence)) { return deviceCorrespondence }

  return assocPath(['identification', 'site'], siteCorrespondence, deviceCorrespondence);
};

// mergeSites :: (Array a, Array b) -> DeviceCorrespondenceList
//     DeviceCorrespondenceList = Array.<DeviceCorrespondence>
const mergeSites = (deviceCorrespondenceList, siteCorrespondenceList) => {
  const siteCorrespondenceMap = keyBy(get(['identification', 'id']), siteCorrespondenceList);
  const toDeviceSitePairs = device => [device, getOr(null, device.identification.siteId, siteCorrespondenceMap)];
  const deviceSitePairs = deviceCorrespondenceList.map(toDeviceSitePairs);

  return map(spread(mergeSite), deviceSitePairs);
};

// mergeOnusWithOnuProfiles :: (CmOnus, CmProfiles) -> Either.<CmOnus>
//    CmOnus      = Array.<Object>
//    CmProfiles  = Array.<Object>
const mergeOnusWithOnuProfiles = (cmOnus, cmProfiles) => map(
  onu => converge(assocPath(['onu', 'profileName']), [
    pipe(() => find(pathEq(['id'], onu.onu.profile), cmProfiles), get(['name'])),
    identity,
  ])(onu)
)(cmOnus);

// mergeOnuUpdateRequestUpdateWithOnuDevice :: (CmOnuDevice, CmOnuUpdateRequest) -> CmOnuDevice
//    CmOnuDevice         = Object
//    CmOnuUpdateRequest  = Object
const mergeOnuUpdateRequestUpdateWithOnuDevice = (cmOnuDevice, cmOnuUpdateRequest) => pipe(
  assocPath(['enabled'], cmOnuUpdateRequest.enabled),
  assocPath(['identification', 'name'], cmOnuUpdateRequest.name),
  assocPath(['onu', 'profile'], cmOnuUpdateRequest.profile)
)(cmOnuDevice);

// mergeInterfaces :: (Object, Object) -> DeviceCorrespondenceData
//     DeviceCorrespondenceData = Object
const mergeInterfaces = (cmDeviceData, cmInterfaceListData) =>
  assocPath(['interfaces'], cmInterfaceListData, cmDeviceData);

/**
 * @param {DeviceMetadataCorrespondence} deviceMetadataCorrespondence
 * @param {DeviceCorrespondence} deviceCorrespondence
 * @return {DeviceCorrespondence}
 */
// mergeMetadata :: (Object, Object) -> DeviceCorrespondence
//     DeviceCorrespondence = Object
const mergeMetadata = (deviceCorrespondence, deviceMetadataCorrespondence) => {
  if (isNull(deviceMetadataCorrespondence)) { return deviceCorrespondence }

  return assocPath(['meta'], deviceMetadataCorrespondence, deviceCorrespondence);
};

// mergeMetadataList :: (Array a, Array b) -> DeviceCorrespondenceList
//     DeviceCorrespondenceList = Array.<DeviceCorrespondence>
const mergeMetadataList = (deviceMetadataCorrespondenceList, deviceCorrespondenceList) => {
  const deviceMetadataCorrespondenceMap = keyBy(get(['id']), deviceMetadataCorrespondenceList);
  const defaultMetadata = {
    id: null,
    failedMessageDecryption: false,
    restartTimestamp: null,
    alias: null,
    note: null,
  };
  const toDeviceMetadataPairs = device =>
    [device, getOr(defaultMetadata, device.identification.id, deviceMetadataCorrespondenceMap)];
  const deviceMetadataPairs = deviceCorrespondenceList.map(toDeviceMetadataPairs);

  return map(spread(mergeMetadata), deviceMetadataPairs);
};

/**
 * Merge together multiple device updates.
 *
 * @function mergeDeviceUpdate
 * @param {CorrespondenceDevice} device
 * @param {CorrespondenceDeviceUpdate} ...updates
 * @return {CorrespondenceDevice}
 */
const mergeDeviceUpdate = unapply(mergeAllWith((objValue, srcValue, key) => {
  if (key === 'interfaces' && Array.isArray(srcValue) && Array.isArray(objValue)
    && pathSatisfies(isNull, [0, 'statistics'], srcValue)) {
    // TODO(michal.sedlak@ubnt.com): Interface merge is only 100% correct for Erouters/OLTs
    // Statistics are SHOULD BE NULL for Vyatta Devices
    return mergeHwAndDbLists(srcValue, objValue);
  }

  if (Array.isArray(srcValue)) {
    return srcValue;
  }
  return undefined;
}));

/**
 * @param {StationCorrespondence} stationCorrespondence
 * @param {DeviceIdentificationCorrespondence} deviceCorrespondence
 * @return {StationCorrespondence}
 */
const mergeStationWithDevice = (stationCorrespondence, deviceCorrespondence) => {
  if (isNull(deviceCorrespondence)) { return stationCorrespondence }

  return assocPath(['deviceIdentification'], deviceCorrespondence, stationCorrespondence);
};

// mergeStationListWithDeviceList :: (Array, Array) -> Array.<StationCorrespondence>
const mergeStationListWithDeviceList = (stationCorrespondenceList, deviceCorrespondenceList) => {
  const keyByInterfaceMacs = (deviceInterfaceMap, device) => pipe(
    getOr([], ['interfaces']),
    map(get(['identification', 'mac'])),
    map(mac => pair(mac, get(['identification'], device))),
    fromPairs,
    merge(deviceInterfaceMap)
  )(device);
  const deviceCorrespondenceMap = reduce(keyByInterfaceMacs, {}, deviceCorrespondenceList);
  const toStationDevicePairs = station => [station, getOr(null, station.mac, deviceCorrespondenceMap)];
  const stationDevicePairs = stationCorrespondenceList.map(toStationDevicePairs);

  return map(spread(mergeStationWithDevice), stationDevicePairs);
};

module.exports = {
  mergeSite,
  mergeSites,
  mergeDeviceUpdate,

  mergeOnusWithOnuProfiles,
  mergeOnuUpdateRequestUpdateWithOnuDevice,
  mergeInterfaces,

  mergeMetadata,
  mergeMetadataList,

  mergeStationWithDevice,
  mergeStationListWithDeviceList,

};
