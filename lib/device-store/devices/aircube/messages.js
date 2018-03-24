'use strict';

const { partial } = require('lodash/fp');

const { rpcRequest } = require('../../backends/ubridge/messages');

const subscribeEventsRequest = partial(rpcRequest, [
  ['config.change'],
  'subscribeEvents',
  'ubus',
]);

module.exports = {
  subscribeEventsRequest,
};
