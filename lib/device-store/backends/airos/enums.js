'use strict';

const MessageNameEnum = Object.freeze({
  Status: 'getStatus',
  Config: 'getConfig',
  PingStats: 'getPingStats',
  ConfigCheck: 'getConfigCheck',
  AirView: 'getAirView',
  StationList: 'getWStaList',
  InterfaceStats: 'getInterfaceStats',
});

module.exports = {
  MessageNameEnum,
};
