'use strict';

const { defaultTo, toLower } = require('lodash/fp');

const { DeviceModelEnum } = require('../../../enums');

const KNOWN_DEVICE_DESCRIPTIONS = [
  // - Rocket
  [DeviceModelEnum.R2N, ['Rocket M2']],
  [DeviceModelEnum.R2T, ['Rocket M2 Titanium']],
  [DeviceModelEnum.R5N, ['Rocket M5']],
  [DeviceModelEnum.R6N, ['Rocket M6']],
  [DeviceModelEnum.R36GPS, ['Rocket M365 GPS']],
  [DeviceModelEnum.RM3GPS, ['Rocket M3 GPS']],
  [DeviceModelEnum.R2NGPS, ['Rocket M2 GPS']],
  [DeviceModelEnum.R5NGPS, ['Rocket M5 GPS']],
  [DeviceModelEnum.R9NGPS, ['Rocket M900 GPS']],
  [DeviceModelEnum.R5TGPS, ['Rocket M5 Titanium', 'Rocket M5 Titanium GPS', 'R5T']],
  [DeviceModelEnum.RM3, ['Rocket M3']],
  [DeviceModelEnum.R36, ['Rocket M365']],
  [DeviceModelEnum.R9N, ['Rocket M900']],
  // - NanoStation
  [DeviceModelEnum.N2N, ['NanoStation M2']],
  [DeviceModelEnum.N5N, ['NanoStation M5']],
  [DeviceModelEnum.N6N, ['NanoStation M6']],
  [DeviceModelEnum.NS3, ['NanoStation M3']],
  [DeviceModelEnum.N36, ['NanoStation M365']],
  [DeviceModelEnum.N9N, ['NanoStation Loco M900']],
  [DeviceModelEnum.N9S, ['NanoStation M900']],
  [DeviceModelEnum.LM2, ['NanoStation Loco M2']],
  [DeviceModelEnum.LM5, ['NanoStation Loco M5']],
  // - Bullet
  [DeviceModelEnum.B2N, ['Bullet M2']],
  [DeviceModelEnum.B2T, ['Bullet M2 Titanium']],
  [DeviceModelEnum.B5N, ['Bullet M5']],
  [DeviceModelEnum.B5T, ['Bullet M5 Titanium']],
  // - AirGrid
  [DeviceModelEnum.AG2, ['AirGrid M2']],
  [DeviceModelEnum.AG2HP, ['AirGrid M2 HP']],
  [DeviceModelEnum.AG5, ['AirGrid M5']],
  [DeviceModelEnum.AG5HP, ['AirGrid M5 HP']],
  [DeviceModelEnum.P2N, ['PicoStation M2']],
  [DeviceModelEnum.P5N, ['PicoStation M5']],
  // - LiteStation
  [DeviceModelEnum.M25, ['LiteStation M25']],
  // - PowerBeam
  [DeviceModelEnum.P2B400, ['PowerBeam M2 400', 'PowerBeamM2 400', 'PowerBeam M2', 'P2B']],
  [DeviceModelEnum.P5B300, ['PowerBeam M5 300', 'PowerBeamM5 300', 'PowerBeam M5', 'P5B']],
  [DeviceModelEnum.P5B400, ['PowerBeam M5 400', 'P5B']],
  [DeviceModelEnum.P5B620, ['PowerBeam M5 620', 'P5B']],
  // - LiteBeam
  [DeviceModelEnum.LB5120, ['LiteBeam M5 120']],
  [DeviceModelEnum.LB5, ['LiteBeam M5']],
  // - NanoBeam
  [DeviceModelEnum.N5B, ['NanoBeam M5', 'NanoBeamM5']],
  [DeviceModelEnum.N5B16, ['NanoBeam M5 16', 'NanoBeamM5 16']],
  [DeviceModelEnum.N5B19, ['NanoBeam M5 19', 'NanoBeamM5 19']],
  [DeviceModelEnum.N5B300, ['NanoBeam M5 300', 'NanoBeamM5 300']],
  [DeviceModelEnum.N5B400, ['NanoBeam M5 400', 'NanoBeamM5 400']],
  [DeviceModelEnum.N5BClient, ['NanoBeam M5 Client', 'NanoBeamM5 Client']],
  [DeviceModelEnum.N2B, ['NanoBeam M2', 'NanoBeamM2']],
  [DeviceModelEnum.N2B13, ['NanoBeam M2 13']],
  [DeviceModelEnum.N2B400, ['NanoBeam M2 400', 'NanoBeamM2 400']],
  // - PowerAP
  [DeviceModelEnum.PAP, ['PowerAP N']],
  // - AirRouter
  [DeviceModelEnum.LAPHP, ['AirRouter HP']],
  [DeviceModelEnum.LAP, ['AirRouter']],
  // - AirGateway
  [DeviceModelEnum.AGW, ['airGateway', 'AirGateway', 'Air Gateway']],
  [DeviceModelEnum.AGWLR, ['airGateway LR', 'AirGateway LR', 'Air Gateway LR']],
  [DeviceModelEnum.AGWPro, ['airGateway Pro', 'AGW-Pro', 'Air Gateway Pro']],
  [DeviceModelEnum.AGWInstaller, ['airGateway Installer', 'AGW-Installer']],
  // - PowerBridge
  [DeviceModelEnum.PB5, ['PowerBridge M5']],
  [DeviceModelEnum.PB3, ['PowerBridge M3']],
  [DeviceModelEnum.P36, ['PowerBridge M365']],
  [DeviceModelEnum.PBM10, ['PowerBridge M10']],
  // - NanoBridge
  [DeviceModelEnum.NB5, ['NanoBridge M5']],
  [DeviceModelEnum.NB2, ['NanoBridge M2']],
  [DeviceModelEnum.NB3, ['NanoBridge M3']],
  [DeviceModelEnum.B36, ['NanoBridge M365']],
  [DeviceModelEnum.NB9, ['NanoBridge M900']],
  // - LiteStation
  [DeviceModelEnum.SM5, ['LiteStation M5']],
  // - WispStation
  [DeviceModelEnum.WM5, ['WispStation M5']],
  // - ISO Station
  [DeviceModelEnum.ISM5, ['ISO Station M5', 'IS-M5']],

  /*
   Note that devices with old firmware (5.x and older) will report device Product in the product
   field instead of board name. This fix is introduced since 7.1.4 beta2.
   Older 7.x firmware will report short-name which is non unique.
   */

  // - NanoStation
  [DeviceModelEnum.NS5ACL, ['NanoStation 5AC Loco', 'NS-5ACL', 'N5L']],
  [DeviceModelEnum.NS5AC, ['NanoStation 5AC', 'NS-5AC', 'N5C']],
  // - Rocket
  [DeviceModelEnum.R5ACPTMP, ['Rocket 5AC PTMP', 'R5AC-PTMP', 'R5C']],
  [DeviceModelEnum.R5ACPTP, ['Rocket 5AC PTP', 'R5AC-PTP', 'R5C']],
  [DeviceModelEnum.R5ACLite, ['Rocket 5AC Lite', 'R5AC-Lite', 'R5C']],
  [DeviceModelEnum.R5ACPRISM, ['Rocket 5AC Prism', 'Rocket 5AC Prism M', 'R5AC-PRISM', 'R5AC-PRISM-M', 'R5C']],
  [
    DeviceModelEnum.R2AC,
    ['Rocket 2AC', 'Rocket 2AC Prism', 'Rocket 2AC Prism M', 'R2AC', 'R2AC-PRISM', 'R2AC-PRISM-M', 'R2C'],
  ],
  [DeviceModelEnum.RP5ACGen2, ['Rocket Prism 5AC Gen2', 'RP-5AC-Gen2', 'R5C']],
  // - NanoBeam
  [DeviceModelEnum.NBE2AC13, ['NanoBeam 2AC 13', 'NBE-2AC-13', 'N2C']],
  [DeviceModelEnum.NBE5AC16, ['NanoBeam 5AC 16', 'NBE-5AC-16', 'N5C']],
  [DeviceModelEnum.NBE5AC19, ['NanoBeam 5AC 19', 'NBE-5AC-19', 'N5C']],
  [DeviceModelEnum.NBE5ACGen2, ['NanoBeam 5AC Gen2', 'NBE-5AC-Gen2', 'N5C']],
  // - PowerBeam
  [DeviceModelEnum.PBE5AC300, ['PowerBeam 5AC 300', 'PBE-5AC-300', 'P5C']],
  [DeviceModelEnum.PBE5AC300ISO, ['PowerBeam 5AC 300 ISO', 'PBE-5AC-300-ISO', 'P5C']],
  [DeviceModelEnum.PBE5AC400, ['PowerBeam 5AC 400', 'PBE-5AC-400', 'P5C']],
  [DeviceModelEnum.PBE5AC400ISO, ['PowerBeam 5AC 400 ISO', 'PBE-5AC-400-ISO', 'P5C']],
  [DeviceModelEnum.PBE5AC500, ['PowerBeam 5AC 500', 'PBE-5AC-500', 'P5C']],
  [DeviceModelEnum.PBE5AC500ISO, ['PowerBeam 5AC 500 ISO', 'PBE-5AC-500-ISO', 'P5C']],
  [DeviceModelEnum.PBE5AC620, ['PowerBeam 5AC 620', 'PBE-5AC-620', 'P5C']],
  [DeviceModelEnum.PBE5AC620ISO, ['PowerBeam 5AC 620 ISO', 'PBE-5AC-620-ISO', 'P5C']],
  [DeviceModelEnum.PBE2AC400, ['PowerBeam 2AC 400', 'PBE-2AC-400', 'P2C']],
  [DeviceModelEnum.PBE5ACGen2, ['PowerBeam 5AC Gen2', 'PBE-5AC-Gen2', 'P5C']],
  [DeviceModelEnum.PBE5ACISOGen2, ['PowerBeam 5AC ISO Gen2', 'PBE-5AC-ISO-Gen2', 'P5C']],
  // - LiteBeam
  [DeviceModelEnum.LBE5AC16120, ['LiteBeam 5AC 16 120', 'LBE-5AC-16-120', 'L5C']],
  [DeviceModelEnum.LBE5AC23, ['LiteBeam 5AC 23', 'LBE-5AC-23', 'L5C']],
  [DeviceModelEnum.LBE5ACGen2, ['LiteBeam 5AC Gen2', 'LBE-5AC-Gen2', 'L5C']],
  // - ISO Station
  [DeviceModelEnum.IS5AC, ['ISO Station 5AC', 'IS-5AC', 'I5C']],
  // - PrismStation
  [DeviceModelEnum.PS5AC, ['PrismStation 5AC', 'PS-5AC', 'P5G']],

  // - AirCube
  [DeviceModelEnum.ACBAC, ['airCube AC']],
  [DeviceModelEnum.ACBISP, ['airCube ISP']],
  [DeviceModelEnum.ACBLOCO, ['airCube LOCO']],

  // other devices should be correctly detected by model
];

const deviceDescriptionToModelMap = KNOWN_DEVICE_DESCRIPTIONS
  .reduceRight((accumulator, [value, keys]) => {
    keys.forEach(key => accumulator.set(toLower(key), value));
    return accumulator;
  }, new Map());

// parseDeviceDescription :: DeviceModelDescription -> DeviceModel
//     DeviceModelDescription = String
//     DeviceModel = String|Null
const parseDeviceDescription = description => defaultTo(null, deviceDescriptionToModelMap.get(toLower(description)));


module.exports = {
  parseDeviceDescription,
};
