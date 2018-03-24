'use strict';

const MessageNameEnum = Object.freeze({
  GetConfig: 'getConfig',
  GetDeviceIp: 'getDeviceIp',
  SystemStats: 'system-stats',
  ConfigChange: 'config-change',
  SystemUpgradeStats: 'system-upgrade-stats',
});

module.exports = {
  MessageNameEnum,
};
