'use strict';

const { partial, omitBy } = require('lodash/fp');
const { isNilOrEmpty } = require('ramda-adjunct');

const { MessageNameEnum } = require('./enums');
const { rpcRequest, commandRequest } = require('../ubridge/messages');

const deviceConfigRequest = partial(rpcRequest, [
  {
    GET: {
      interfaces: null,
      service: null,
      system: null,
      protocols: { static: null },
    },
  },
  MessageNameEnum.GetConfig,
  'sys',
]);

/* eslint-disable max-len */
const GET_MACS_CMD = 'echo getInterfaceMacs; ls -1 /sys/class/net/ | while read f; do echo "$f" `cat "/sys/class/net/$f/addr_assign_type" "/sys/class/net/$f/address"`; done';

/* eslint-disable max-len */
const GET_IP_CMD = 'ifconfig `ip route show default 0/0 | sed \'s/\\(.*dev \\)\\([a-z.0-9-]*\\)\\(.*\\)/\\2/g\' | grep -v lo` | grep -v \'127.0\' | grep -oE "\\b\\w+:([0-9]{1,3}\\.){3}[0-9]{1,3}\\b" | tr ":" "=" | tr A-Z a-z | head -3';

const interfaceMacAddressesRequest = partial(commandRequest, [GET_MACS_CMD]);

const deviceIpAddressRequest = partial(commandRequest, [GET_IP_CMD]);

const systemRequest = partial(rpcRequest, [{ GET: { system: null } }, MessageNameEnum.GetSystem, 'sys']);

const servicesRequest = partial(rpcRequest, [{ GET: { system: null, service: null } }, MessageNameEnum.GetServices, 'sys']);

const pingRequest = partial(rpcRequest, [{ PING: null }, 'ping', 'sys']);

const setConfigRequest = (setData, deleteData) => {
  const request = omitBy(isNilOrEmpty, { SET: setData, DELETE: deleteData });

  return rpcRequest(request, MessageNameEnum.SetConfig, 'sys');
};

module.exports = {
  deviceConfigRequest,
  systemRequest,
  servicesRequest,
  pingRequest,
  setConfigRequest,
  interfaceMacAddressesRequest,
  deviceIpAddressRequest,
};
