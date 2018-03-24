'use strict';

const { eq, flow } = require('lodash/fp');

const { isAirMaxDeviceType, isDeviceModelSupported } = require('./common');
const { parseDeviceDescription } = require('../transformers/device/model/parsers');
const { DeviceModelEnum, AirMaxSeriesEnum } = require('../enums');


// deviceModelToSeries :: String -> AirMaxSeriesEnum|Null
//     AirMaxSeriesEnum = String
const deviceModelToSeries = (deviceModel) => {
  let model = deviceModel;

  if (!isDeviceModelSupported(deviceModel)) {
    model = parseDeviceDescription(deviceModel); // try to parse device model from device description
    if (!isAirMaxDeviceType(model)) { return null }
  }

  /* eslint-disable no-fallthrough */
  switch (model) {
    // - Rocket
    case DeviceModelEnum.R2N:
    case DeviceModelEnum.R2T:
    case DeviceModelEnum.R5N:
    case DeviceModelEnum.R6N:
    case DeviceModelEnum.R36GPS:
    case DeviceModelEnum.RM3GPS:
    case DeviceModelEnum.R2NGPS:
    case DeviceModelEnum.R5NGPS:
    case DeviceModelEnum.R9NGPS:
    case DeviceModelEnum.R5TGPS:
    case DeviceModelEnum.RM3:
    case DeviceModelEnum.R36:
    case DeviceModelEnum.R9N:
    // - NanoStation
    case DeviceModelEnum.N2N:
    case DeviceModelEnum.N5N:
    case DeviceModelEnum.N6N:
    case DeviceModelEnum.NS3:
    case DeviceModelEnum.N36:
    case DeviceModelEnum.N9N:
    case DeviceModelEnum.N9S:
    case DeviceModelEnum.LM2:
    case DeviceModelEnum.LM5:
      // - Bullet
    case DeviceModelEnum.B2N:
    case DeviceModelEnum.B2T:
    case DeviceModelEnum.B5N:
    case DeviceModelEnum.B5T:
    // - AirGrid
    case DeviceModelEnum.AG2:
    case DeviceModelEnum.AG2HP:
    case DeviceModelEnum.AG5:
    case DeviceModelEnum.AG5HP:
    case DeviceModelEnum.P2N:
    case DeviceModelEnum.P5N:
    // - LiteStation
    case DeviceModelEnum.M25:
    // - PowerBeam
    case DeviceModelEnum.P2B400:
    case DeviceModelEnum.P5B300:
    case DeviceModelEnum.P5B400:
    case DeviceModelEnum.P5B620:
      // - LiteBeam
    case DeviceModelEnum.LB5120:
    case DeviceModelEnum.LB5:
      // - NanoBeam
    case DeviceModelEnum.N5B:
    case DeviceModelEnum.N5B16:
    case DeviceModelEnum.N5B19:
    case DeviceModelEnum.N5B300:
    case DeviceModelEnum.N5B400:
    case DeviceModelEnum.N5BClient:
    case DeviceModelEnum.N2B:
    case DeviceModelEnum.N2B13:
    case DeviceModelEnum.N2B400:
    // - PowerAP
    // supports only 5/10/20/40 channel widths
    case DeviceModelEnum.PAP:
    // - AirRouter
    case DeviceModelEnum.LAPHP:
    case DeviceModelEnum.LAP:
    // - AirGateway
    // supports only 20/40 channel widths
    case DeviceModelEnum.AGW:
    case DeviceModelEnum.AGWLR:
    case DeviceModelEnum.AGWPro:
    case DeviceModelEnum.AGWInstaller:
    // - PowerBridge
    case DeviceModelEnum.PB5:
    case DeviceModelEnum.PB3:
    case DeviceModelEnum.P36:
    case DeviceModelEnum.PBM10:
    // - NanoBridge
    case DeviceModelEnum.NB5:
    case DeviceModelEnum.NB2:
    case DeviceModelEnum.NB3:
    case DeviceModelEnum.B36:
    case DeviceModelEnum.NB9:
    // - LiteStation
    case DeviceModelEnum.SM5:
    // - WispStation
    case DeviceModelEnum.WM5:
    // - ISO Station
    case DeviceModelEnum.ISM5:
      return AirMaxSeriesEnum.M;
    default:
      return AirMaxSeriesEnum.AC;
  }
  /* eslint-enable no-fallthrough */
};

// isACSeries :: DeviceModel -> Boolean
//     DeviceModel = String
const isACSeries = flow(deviceModelToSeries, eq(AirMaxSeriesEnum.AC));

// isMSeries :: DeviceModel -> Boolean
//     DeviceModel = String
const isMSeries = flow(deviceModelToSeries, eq(AirMaxSeriesEnum.M));


module.exports = {
  deviceModelToSeries,
  isACSeries,
  isMSeries,
};
