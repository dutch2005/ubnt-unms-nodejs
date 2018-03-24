'use strict';

const { partial } = require('lodash/fp');

const { rpcRequest, commandRequest } = require('../../backends/ubridge/messages');
const { MessageNameEnum } = require('./enums');

/* eslint-disable max-len */
const DEVICE_IP_CMD = '/sbin/ifconfig -a | grep inet | grep -v inet6 | grep -v ::1/128 | grep -v :127.0.0 | tail -n1 | awk \'{ print $2,",",$4 }\'';

const DEVICE_CONFIG_CMD = [
  `echo ${MessageNameEnum.GetConfig}`,
  'echo -e -n "[config]\\nversion="',
  'cat /etc/version 2>&1',
  'echo -e -n "hostname="',
  'hostname',
  'echo -e -n "network="',
  DEVICE_IP_CMD,
].join('; ');
/* eslint-enable max-len */

const deviceConfigRequest = partial(commandRequest, [DEVICE_CONFIG_CMD]);

const deviceIpRequest = partial(commandRequest, [`echo ${MessageNameEnum.GetDeviceIp}; ${DEVICE_IP_CMD}`]);

const subscribeEventsRequest = partial(rpcRequest, [
  {
    SUBSCRIBE: [
      { name: 'system-stats' },
      { name: 'config-change' },
    ],
  },
  'subscribeEvents',
  'sys',
]);

module.exports = {
  deviceConfigRequest,
  deviceIpRequest,
  subscribeEventsRequest,
};
