'use strict';

const MessageNameEnum = Object.freeze({
  Connect: 'connect',
  GetSysInfo: 'getSysInfo',
  Ping: 'ping',
  Cmd: 'cmd',
  Unknown: 'unknown',
});

const MessageTypeEnum = Object.freeze({
  Event: 'event',
  Rpc: 'rpc',
  Cmd: 'cmd',
  RpcError: 'rpc-error',
});

module.exports = {
  MessageNameEnum,
  MessageTypeEnum,
};
