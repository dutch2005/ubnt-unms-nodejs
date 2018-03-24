'use strict';

const aguid = require('aguid');
const { partial, __ } = require('lodash/fp');

const { MessageTypeEnum, MessageNameEnum } = require('../../../transformers/socket/enums');

const rpcRequest = (request, name, socket = 'sys', meta = {}) => ({
  id: aguid(),
  type: MessageTypeEnum.Rpc,
  socket,
  name,
  request,
  meta,
});

const sysInfoRequest = partial(rpcRequest, [{ GETDATA: 'sys_info' }, MessageNameEnum.GetSysInfo, 'sys']);

const commandRequest = partial(rpcRequest, [__, MessageNameEnum.Cmd, 'sys']);

const pingRequest = partial(rpcRequest, [{}, MessageNameEnum.Ping, 'sys']);

const pingStatsRequest = partial(rpcRequest, [{}, 'getPingStats', 'sys']);

module.exports = {
  pingRequest,
  rpcRequest,
  pingStatsRequest,
  commandRequest,
  sysInfoRequest,
};
