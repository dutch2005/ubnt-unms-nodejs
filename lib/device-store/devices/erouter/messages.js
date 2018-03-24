'use strict';

const { partial } = require('lodash/fp');

const { rpcRequest } = require('../../backends/ubridge/messages');

const subscribeEventsRequest = partial(rpcRequest, [
  {
    SUBSCRIBE: [
      { name: 'interfaces' },
      { name: 'system-stats' },
      { name: 'config-change' },
    ],
  },
  'subscribeEvents',
  'sys',
]);

module.exports = {
  subscribeEventsRequest,
};
