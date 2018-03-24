'use strict';

const { isArray, partial } = require('lodash/fp');

const { rpcRequest, commandRequest } = require('../ubridge/messages');
const { MessageNameEnum } = require('./enums');

const UBUS_SOCKET = 'ubus';

const ubusRequest = (request, meta = {}) => {
  if (isArray(request)) {
    return rpcRequest(request, MessageNameEnum.UbusBatch, UBUS_SOCKET, meta);
  }

  return rpcRequest(request, MessageNameEnum.Ubus, UBUS_SOCKET, meta);
};

const CONFIG_CHECK_CMD = 'find /etc/config/* -type f -name * -print | xargs cat | md5sum | cut -d" " -f1';

const configCheckRequest = partial(commandRequest, [CONFIG_CHECK_CMD]);

module.exports = {
  ubusRequest,
  configCheckRequest,
};
