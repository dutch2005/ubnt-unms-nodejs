'use strict';

const { StatusEnum } = require('../../../enums');
const { mergeDeviceUpdate } = require('../mergers');


// mergeDbWithHw :: (Object, Object) -> DeviceCorrespondenceData
//     DeviceCorrespondenceData = Object
const mergeDbWithHw = (dbDeviceCorrespondenceData, hwDeviceCorrespondenceData) => {
  const newStatus = dbDeviceCorrespondenceData.identification.authorized ? StatusEnum.Active : StatusEnum.Unauthorized;

  return mergeDeviceUpdate(dbDeviceCorrespondenceData, {
    identification: {
      mac: hwDeviceCorrespondenceData.identification.mac,
      name: hwDeviceCorrespondenceData.identification.name,
      model: hwDeviceCorrespondenceData.identification.model,
      type: hwDeviceCorrespondenceData.identification.type,
      category: hwDeviceCorrespondenceData.identification.category,
      firmwareVersion: hwDeviceCorrespondenceData.identification.firmwareVersion,
      platformId: hwDeviceCorrespondenceData.identification.platformId,
      updated: hwDeviceCorrespondenceData.identification.updated,
      ipAddress: hwDeviceCorrespondenceData.identification.ipAddress,
    },
    overview: {
      lastSeen: hwDeviceCorrespondenceData.overview.lastSeen,
      signal: hwDeviceCorrespondenceData.overview.signal,
      status: newStatus,
      uptime: hwDeviceCorrespondenceData.overview.uptime,
      cpu: hwDeviceCorrespondenceData.overview.cpu,
      ram: hwDeviceCorrespondenceData.overview.ram,
      distance: hwDeviceCorrespondenceData.overview.distance,
      transmitPower: hwDeviceCorrespondenceData.overview.transmitPower,
    },
    mode: hwDeviceCorrespondenceData.mode,
    airmax: {
      series: hwDeviceCorrespondenceData.airmax.series,
      ssid: hwDeviceCorrespondenceData.airmax.ssid,
      frequency: hwDeviceCorrespondenceData.airmax.frequency,
      frequencyCenter: hwDeviceCorrespondenceData.airmax.frequencyCenter,
      security: hwDeviceCorrespondenceData.airmax.security,
      channelWidth: hwDeviceCorrespondenceData.airmax.channelWidth,
      antenna: hwDeviceCorrespondenceData.airmax.antenna,
      noiseFloor: hwDeviceCorrespondenceData.airmax.noiseFloor,
      ccq: hwDeviceCorrespondenceData.airmax.ccq,
      stationsCount: hwDeviceCorrespondenceData.airmax.stationsCount,
      wirelessMode: hwDeviceCorrespondenceData.airmax.wirelessMode,
      remoteSignal: hwDeviceCorrespondenceData.airmax.remoteSignal,
      lanStatus: hwDeviceCorrespondenceData.airmax.lanStatus,
      transmitChains: hwDeviceCorrespondenceData.airmax.transmitChains,
      receiveChains: hwDeviceCorrespondenceData.airmax.receiveChains,
      apMac: hwDeviceCorrespondenceData.airmax.apMac,
      wlanMac: hwDeviceCorrespondenceData.airmax.wlanMac,
    },
    interfaces: hwDeviceCorrespondenceData.interfaces,
  });
};


module.exports = {
  mergeDbWithHw,
};
