'use strict';

const MessageNameEnum = Object.freeze({
  GetConfig: 'getConfig',
  GetSystem: 'getSystem',
  GetServices: 'getServices',
  GetInterfaces: 'getInterfaces',
  SetConfig: 'setConfig',
  SetOnuConfig: 'setOnuConfig',
  Interfaces: 'interfaces',
  InterfaceMacs: 'getInterfaceMacs',
  SystemStats: 'system-stats',
  PonStats: 'pon-stats',
  ConfigChange: 'config-change',
});

module.exports = {
  MessageNameEnum,
};
