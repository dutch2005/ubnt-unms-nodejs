'use strict';

const { merge, defaultTo, reduce, keyBy, get, has, flow, find, __ } = require('lodash/fp');
const { both } = require('ramda');
const { isNotNull } = require('ramda-adjunct');

const { DiscoveryConnectStatusEnum, StatusEnum } = require('../../../enums');
const { pathNotEq, getValueOr } = require('../../../util');
const { indexByMacAddress } = require('./utils');

const isConnected = both(
  isNotNull,
  pathNotEq(['overview', 'status'], StatusEnum.Disconnected)
);

/**
 * @param {CorrespondenceDevice} cmDevice
 * @param {CorrespondenceDiscoveryDevice} cmData
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeCorrespondenceDevice = (cmDevice, cmData) => {
  const isDeviceConnected = isConnected(cmDevice);
  if (isDeviceConnected) {
    return merge(cmData, {
      connectStatus: DiscoveryConnectStatusEnum.Connected,
      name: getValueOr(cmData.name, ['identification', 'name'], cmDevice),
      firmwareVersion: getValueOr(
        cmData.firmwareVersion, ['identification', 'firmwareVersion'], cmDevice
      ),
      firmware: getValueOr(
        cmData.firmware, ['firmware'], cmDevice
      ),
      siteId: getValueOr(cmData.siteId, ['identification', 'siteId'], cmDevice),
      authorized: getValueOr(cmData.authorized, ['identification', 'authorized'], cmDevice),
    });
  }

  let connectStatus = cmData.connectStatus;
  if (!isDeviceConnected && cmData.connectStatus === DiscoveryConnectStatusEnum.Connected) {
    connectStatus = DiscoveryConnectStatusEnum.NotConnected;
  }

  return merge(cmData, {
    connectStatus,
    siteId: getValueOr(cmData.siteId, ['identification', 'siteId'], cmDevice),
    authorized: getValueOr(cmData.authorized, ['identification', 'authorized'], cmDevice),
  });
};

/**
 * @param {CorrespondenceDevice[]} cmDeviceList
 * @param {CorrespondenceDiscoveryDevice[]} cmDataList
 * @return {CorrespondenceDiscoveryDevice[]}
 */
const mergeCorrespondenceDeviceList = (cmDeviceList, cmDataList) => {
  const cmDevicesMacMap = reduce(indexByMacAddress, new Map(), cmDeviceList);
  const cmDevicesIdMap = keyBy(get(['identification', 'id']), cmDeviceList);
  const findById = flow(find(has(__, cmDevicesIdMap)), get(__, cmDevicesIdMap));

  return cmDataList.map((cmData) => {
    const relatedCmDevice = cmDevicesMacMap.get(cmData.mac) || findById(cmData.possibleIds);
    return mergeCorrespondenceDevice(defaultTo(null, relatedCmDevice), cmData);
  });
};

/**
 * @param {CorrespondenceDiscoveryResult} cmDiscoveryResult
 * @param {CorrespondenceDiscoveryDevice} cmData
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeDiscoveryResult = (cmDiscoveryResult, cmData) => merge(cmData, {
  resultId: cmDiscoveryResult.id,
  userId: cmDiscoveryResult.userId,
});

/**
 * Update dbDiscoveryDevice with new data from scan
 *
 * @param {CorrespondenceDiscoveryDevice} hwCorrespondence
 * @param {CorrespondenceDiscoveryDevice} dbCorrespondence
 * @return {CorrespondenceDiscoveryDevice}
 */
const mergeDbAndHwDiscoveryDevice = (hwCorrespondence, dbCorrespondence) => merge(dbCorrespondence, {
  possibleIds: hwCorrespondence.possibleIds,
  firmwareVersion: hwCorrespondence.firmwareVersion,
  isFirmwareSupported: hwCorrespondence.isFirmwareSupported,
  model: hwCorrespondence.model,
  name: hwCorrespondence.name,
  mac: hwCorrespondence.mac,
  ip: hwCorrespondence.ip,
  type: hwCorrespondence.type,
  category: hwCorrespondence.category,
  uptime: hwCorrespondence.uptime,
});

module.exports = {
  mergeCorrespondenceDevice,
  mergeDiscoveryResult,
  mergeDbAndHwDiscoveryDevice,
  mergeCorrespondenceDeviceList,
};
